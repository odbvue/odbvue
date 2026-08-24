import { $fetch, type FetchOptions } from 'ofetch'

const baseURL = (import.meta as ImportMeta & { env?: { DEV?: boolean; VITE_API_URI?: string } }).env
  ?.DEV
  ? '/api/'
  : (import.meta as ImportMeta & { env?: { VITE_API_URI?: string } }).env?.VITE_API_URI

let isRefreshing = false
const requestQueue: Array<{
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  request: string
  options?: FetchOptions<'json'>
}> = []

export interface HttpResponse<T = unknown> {
  data: T | null
  error: Error | null
  status: number | null
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

function authHeaders(): Record<string, string> {
  const token = httpConfiguration.getAccessToken?.()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function flushQueuedRequests(client: ReturnType<typeof $fetch.create>): Promise<void> {
  while (requestQueue.length > 0) {
    const queued = requestQueue.shift()
    if (!queued) continue
    try {
      queued.resolve(await executeRequest(client, queued.request, queued.options))
    } catch (error) {
      queued.reject(error)
    }
  }
}

function rejectQueuedRequests(error: Error): void {
  while (requestQueue.length > 0) requestQueue.shift()?.reject(error)
}

async function executeRequest<T>(
  client: ReturnType<typeof $fetch.create>,
  request: string,
  options?: FetchOptions<'json'>,
): Promise<HttpResponse<T>> {
  try {
    const startTime = performance.now()
    const data = await client<T>(request, {
      ...options,
      headers: { ...authHeaders(), ...(options?.headers as Record<string, string>) },
    })
    const duration = performance.now() - startTime
    if (
      typeof httpConfiguration.slowRequestThresholdMs === 'number' &&
      duration >= httpConfiguration.slowRequestThresholdMs
    )
      httpConfiguration.onSlowRequest?.({ request, duration, options })
    return { data, error: null, status: 200 }
  } catch (error) {
    const status = getErrorStatus(error)
    const shouldRefresh =
      status === 401 &&
      !!httpConfiguration.refreshAccessToken &&
      (httpConfiguration.shouldRefresh?.(request, options) ?? true)
    if (shouldRefresh) {
      const expired = new Error('session.expired')
      if (isRefreshing)
        return new Promise((resolve, reject) =>
          requestQueue.push({
            resolve: resolve as (value: unknown) => void,
            reject,
            request,
            options,
          }),
        )
      isRefreshing = true
      try {
        if (await httpConfiguration.refreshAccessToken?.()) {
          const retry = await executeRequest<T>(client, request, options)
          await flushQueuedRequests(client)
          return retry
        }
        rejectQueuedRequests(expired)
        httpConfiguration.onRefreshFailure?.({ request, error: expired, options })
      } catch (refreshError) {
        rejectQueuedRequests(expired)
        httpConfiguration.onRefreshFailure?.({ request, error: refreshError, options })
      } finally {
        isRefreshing = false
      }
    }
    return { data: null, error: error instanceof Error ? error : new Error(String(error)), status }
  }
}

export function useHttp(): HttpClient {
  let retryCount = 0
  const client = $fetch.create({
    baseURL,
    retry: 3,
    retryStatusCodes: [500, 502, 503, 504],
    retryDelay: () => 300 * 2 ** retryCount++ + Math.random() * 150,
  })
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
