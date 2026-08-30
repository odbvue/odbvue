import { $fetch, type FetchContext, type FetchOptions } from 'ofetch'

const baseURL = (import.meta as ImportMeta & { env?: { DEV?: boolean; VITE_API_URI?: string } }).env
  ?.DEV
  ? '/api/'
  : (import.meta as ImportMeta & { env?: { VITE_API_URI?: string } }).env?.VITE_API_URI

let refreshPromise: Promise<boolean> | null = null

export interface HttpResponse<T = unknown> {
  data: T | null
  error: HttpError | null
  status: number | null
  headers: Headers | null
}
export interface HttpError extends Error {
  status: number | null
  data?: unknown
  request: string
}
export interface HttpSlowRequestContext {
  request: string
  duration: number
  options?: FetchOptions<'json'>
}
export interface HttpRefreshFailureContext {
  request: string
  error?: unknown
  options?: FetchOptions<'json'>
}
export interface HttpConfiguration {
  getAccessToken?: () => string | null | undefined
  slowRequestThresholdMs?: number
  onSlowRequest?: (context: HttpSlowRequestContext) => void
  refreshAccessToken?: () => Promise<boolean>
  shouldRefresh?: (request: string, options?: FetchOptions<'json'>) => boolean
  onRefreshFailure?: (context: HttpRefreshFailureContext) => void
}
export interface HttpClientOptions {
  /** Overrides fetch for a dedicated client, such as deterministic tests or a sandbox. */
  fetch?: typeof globalThis.fetch
}
export interface HttpClient {
  <T>(request: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  get<T>(url: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  post<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  put<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  delete<T>(url: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  patch<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
}

const httpConfiguration: HttpConfiguration = {
  shouldRefresh: (request) => !request.includes('refresh/') && !request.includes('login/'),
}
export function configureHttp(configuration: HttpConfiguration): void {
  Object.assign(httpConfiguration, configuration)
}

/** Configures OdbVue's HTTP client with framework defaults and app overrides. */
export function configureOdbVueHttp(options: HttpConfiguration = {}): void {
  const { onSlowRequest, slowRequestThresholdMs = 3000, ...configuration } = options
  configureHttp({
    ...configuration,
    slowRequestThresholdMs,
    onSlowRequest:
      onSlowRequest ??
      (({ request, duration }) => {
        console.warn(`Slow API call: ${request} (${Math.round(duration)}ms)`)
      }),
  })
}

function getErrorStatus(error: unknown): number | null {
  if (!(error instanceof Error)) return null
  const response = error as Error & { status?: unknown; statusCode?: unknown }
  return typeof response.statusCode === 'number'
    ? response.statusCode
    : typeof response.status === 'number'
      ? response.status
      : null
}

function createHttpError(error: unknown, request: string, status: number | null): HttpError {
  const source = error instanceof Error ? error : new Error(String(error))
  const response = error as { data?: unknown }
  return Object.assign(source, { status, request, data: response?.data })
}

function authHeaders(): Record<string, string> {
  const token = httpConfiguration.getAccessToken?.()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    const refresh = httpConfiguration.refreshAccessToken
    refreshPromise = Promise.resolve(refresh ? refresh() : false).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

function retryDelay(context: FetchContext): number {
  const retryAfter = context.response?.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
    const retryAt = Date.parse(retryAfter)
    if (!Number.isNaN(retryAt)) return Math.max(0, retryAt - Date.now())
  }
  const retriesRemaining = typeof context.options.retry === 'number' ? context.options.retry : 0
  const attempt = 3 - retriesRemaining
  return 300 * 2 ** Math.max(0, attempt) + Math.random() * 150
}

function requestRetryOptions(options?: FetchOptions<'json'>): FetchOptions<'json'> {
  if (options?.retry !== undefined) return options
  const method = (options?.method ?? 'GET').toUpperCase()
  return { ...options, retry: ['GET', 'HEAD', 'OPTIONS'].includes(method) ? 3 : 0 }
}

async function executeRequest<T>(
  client: ReturnType<typeof $fetch.create>,
  request: string,
  options?: FetchOptions<'json'>,
  didRefresh = false,
): Promise<HttpResponse<T>> {
  try {
    const startTime = performance.now()
    const response = await client.raw<T>(request, {
      ...requestRetryOptions(options),
      headers: { ...authHeaders(), ...(options?.headers as Record<string, string>) },
    })
    const duration = performance.now() - startTime
    if (
      typeof httpConfiguration.slowRequestThresholdMs === 'number' &&
      duration >= httpConfiguration.slowRequestThresholdMs
    )
      httpConfiguration.onSlowRequest?.({ request, duration, options })
    return {
      data: response._data ?? null,
      error: null,
      status: response.status,
      headers: response.headers,
    }
  } catch (error) {
    const status = getErrorStatus(error)
    const shouldRefresh =
      status === 401 &&
      !!httpConfiguration.refreshAccessToken &&
      (httpConfiguration.shouldRefresh?.(request, options) ?? true)
    if (shouldRefresh && !didRefresh) {
      const expired = new Error('session.expired')
      try {
        if (await refreshAccessToken()) return executeRequest<T>(client, request, options, true)
        httpConfiguration.onRefreshFailure?.({ request, error: expired, options })
      } catch (refreshError) {
        httpConfiguration.onRefreshFailure?.({ request, error: refreshError, options })
      }
    }
    return { data: null, error: createHttpError(error, request, status), status, headers: null }
  }
}

export function useHttp(clientOptions: HttpClientOptions = {}): HttpClient {
  const client = $fetch.create(
    {
      baseURL,
      retry: 0,
      retryStatusCodes: [408, 425, 429, 500, 502, 503, 504],
      retryDelay,
    },
    clientOptions,
  )
  const http = (<T>(request: string, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, request, options)) as HttpClient
  http.get = (url, options) => executeRequest(client, url, { ...options, method: 'GET' })
  http.post = (url, body, options) =>
    executeRequest(client, url, {
      ...options,
      method: 'POST',
      body: body as Record<string, unknown>,
    })
  http.put = (url, body, options) =>
    executeRequest(client, url, {
      ...options,
      method: 'PUT',
      body: body as Record<string, unknown>,
    })
  http.delete = (url, options) => executeRequest(client, url, { ...options, method: 'DELETE' })
  http.patch = (url, body, options) =>
    executeRequest(client, url, {
      ...options,
      method: 'PATCH',
      body: body as Record<string, unknown>,
    })
  return http
}
