import { $fetch, type FetchContext, type FetchOptions } from 'ofetch'
import { defineCapability } from '../../runtime/capability.js'
import { defineContract } from '../../runtime/contract.js'
import type { OdbVueHooks } from '../../runtime/hooks.js'

const baseURL = (import.meta as ImportMeta & { env?: { DEV?: boolean; VITE_API_URI?: string } }).env
  ?.DEV
  ? '/api/'
  : (import.meta as ImportMeta & { env?: { VITE_API_URI?: string } }).env?.VITE_API_URI

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
  /** Overrides runtime HTTP configuration for this client only. */
  configuration?: HttpConfiguration
  /** Emits HTTP lifecycle events to this application's hook dispatcher. */
  hooks?: OdbVueHooks
}
export interface HttpClient {
  <T>(request: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  get<T>(url: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  post<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  put<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  delete<T>(url: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  patch<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
}

export const httpContract = defineContract<HttpClient>('http')

export const httpCapability = defineCapability({
  name: 'http',
  setup(context) {
    context.provide(httpContract, createOdbVueHttp(context.config.http, context.hooks))
  },
})

const defaultHttpConfiguration: HttpConfiguration = {
  shouldRefresh: (request) => !request.includes('refresh/') && !request.includes('login/'),
}

/** Creates an application-scoped HTTP client with OdbVue defaults. */
export function createOdbVueHttp(options: HttpConfiguration = {}, hooks?: OdbVueHooks): HttpClient {
  const { onSlowRequest, slowRequestThresholdMs = 3000, ...configuration } = options
  return useHttp({
    hooks,
    configuration: {
      ...configuration,
      slowRequestThresholdMs,
      onSlowRequest:
        onSlowRequest ??
        (({ request, duration }) => {
          console.warn(`Slow API call: ${request} (${Math.round(duration)}ms)`)
        }),
    },
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
  return Object.assign(new Error(source.message), {
    name: source.name,
    status,
    request,
    data: response?.data,
  })
}

function retryDelay(context: FetchContext): number {
  const retryAfter = context.response?.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
    const retryAt = Date.parse(retryAfter)
    if (!Number.isNaN(retryAt)) return Math.max(0, retryAt - Date.now())
  }
  return 300 + Math.random() * 150
}

function requestRetryOptions(options?: FetchOptions<'json'>): FetchOptions<'json'> {
  if (options?.retry !== undefined) return options
  const method = (options?.method ?? 'GET').toUpperCase()
  return { ...options, retry: ['GET', 'HEAD', 'OPTIONS'].includes(method) ? 3 : 0 }
}

async function executeRequest<T>(
  client: ReturnType<typeof $fetch.create>,
  configuration: HttpConfiguration,
  hooks: OdbVueHooks | undefined,
  refresh: () => Promise<boolean>,
  request: string,
  options?: FetchOptions<'json'>,
  didRefresh = false,
): Promise<HttpResponse<T>> {
  try {
    const startTime = performance.now()
    const response = await client.raw<T>(request, {
      ...requestRetryOptions(options),
      headers: {
        ...(configuration.getAccessToken?.()
          ? { Authorization: `Bearer ${configuration.getAccessToken?.()}` }
          : {}),
        ...(options?.headers as Record<string, string>),
      },
    })
    const duration = performance.now() - startTime
    if (
      typeof configuration.slowRequestThresholdMs === 'number' &&
      duration >= configuration.slowRequestThresholdMs
    ) {
      const context = { request, duration, options }
      configuration.onSlowRequest?.(context)
      void hooks?.emit('http:slow', context)
    }
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
      !!configuration.refreshAccessToken &&
      (configuration.shouldRefresh?.(request, options) ?? true)
    if (shouldRefresh && !didRefresh) {
      const expired = new Error('session.expired')
      try {
        if (await refresh())
          return executeRequest<T>(client, configuration, hooks, refresh, request, options, true)
        const context = { request, error: expired, options }
        configuration.onRefreshFailure?.(context)
        void hooks?.emit('http:refreshFailed', context)
      } catch (refreshError) {
        const context = { request, error: refreshError, options }
        configuration.onRefreshFailure?.(context)
        void hooks?.emit('http:refreshFailed', context)
      }
    }
    const httpError = createHttpError(error, request, status)
    void hooks?.emit('http:error', { error: httpError })
    return { data: null, error: httpError, status, headers: null }
  }
}

export function useHttp(clientOptions: HttpClientOptions = {}): HttpClient {
  const configuration = { ...defaultHttpConfiguration, ...clientOptions.configuration }
  let refreshPromise: Promise<boolean> | null = null
  const refresh = (): Promise<boolean> => {
    if (!refreshPromise) {
      const refreshAccessToken = configuration.refreshAccessToken
      refreshPromise = Promise.resolve(refreshAccessToken ? refreshAccessToken() : false).finally(
        () => {
          refreshPromise = null
        },
      )
    }
    return refreshPromise
  }
  const client = $fetch.create(
    {
      baseURL,
      retry: 0,
      retryStatusCodes: [408, 425, 429, 500, 502, 503, 504],
      retryDelay,
    },
    { fetch: clientOptions.fetch },
  )
  const http = (<T>(request: string, options?: FetchOptions<'json'>) =>
    executeRequest<T>(
      client,
      configuration,
      clientOptions.hooks,
      refresh,
      request,
      options,
    )) as HttpClient
  http.get = (url, options) =>
    executeRequest(client, configuration, clientOptions.hooks, refresh, url, {
      ...options,
      method: 'GET',
    })
  http.post = (url, body, options) =>
    executeRequest(client, configuration, clientOptions.hooks, refresh, url, {
      ...options,
      method: 'POST',
      body: body as Record<string, unknown>,
    })
  http.put = (url, body, options) =>
    executeRequest(client, configuration, clientOptions.hooks, refresh, url, {
      ...options,
      method: 'PUT',
      body: body as Record<string, unknown>,
    })
  http.delete = (url, options) =>
    executeRequest(client, configuration, clientOptions.hooks, refresh, url, {
      ...options,
      method: 'DELETE',
    })
  http.patch = (url, body, options) =>
    executeRequest(client, configuration, clientOptions.hooks, refresh, url, {
      ...options,
      method: 'PATCH',
      body: body as Record<string, unknown>,
    })
  return http
}
