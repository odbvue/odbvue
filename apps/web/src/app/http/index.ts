import { $fetch, type FetchContext, type FetchOptions } from 'ofetch'
import { auth } from '../auth'
import { appConfig } from '../config'
import { captureError } from '../errors'
import { decodeOdbJson, requiresBearerToken, type OdbOpenApiDocument } from './json.js'

type HttpRequestOptions = FetchOptions<'json' | 'blob'>

export { decodeOdbJson, type OdbOpenApiDocument } from './json.js'

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
  options?: HttpRequestOptions
}
export interface HttpRefreshFailureContext {
  request: string
  error?: unknown
  options?: HttpRequestOptions
}
export interface HttpConfiguration {
  onError?: (error: HttpError) => void
  getAccessToken?: () => string | null | undefined
  slowRequestThresholdMs?: number
  onSlowRequest?: (context: HttpSlowRequestContext) => void
  refreshAccessToken?: () => Promise<boolean>
  shouldRefresh?: (request: string, options?: HttpRequestOptions) => boolean
  onRefreshFailure?: (context: HttpRefreshFailureContext) => void
  /** OpenAPI document used to parse ODB `json` response fields into values. */
  openapi?: OdbOpenApiDocument
}
export interface HttpClientOptions {
  /** Overrides fetch for a dedicated client, such as deterministic tests or a sandbox. */
  fetch?: typeof globalThis.fetch
  /** Overrides runtime HTTP configuration for this client only. */
  configuration?: HttpConfiguration
}
export interface HttpUploadMetadata {
  fileName?: string
  mimeType?: string
  meta?: unknown
}
export type HttpDownloadOptions = HttpRequestOptions & { expectedSize?: number }
export interface HttpClient {
  <T>(request: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>
  get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>
  post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>
  put<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>
  delete<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>
  patch<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>
  upload<T>(
    url: string,
    file: File,
    metadata?: HttpUploadMetadata,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>
  download(url: string, fileName: string, options?: HttpDownloadOptions): Promise<void>
}

function isTokenEndpoint(request: string): boolean {
  const [path = ''] = request.split(/[?#]/, 1)
  const pathname = path.replace(/\/+$/, '')
  return /(?:^|\/)(?:refresh|login|logout)$/.test(pathname)
}

const defaultHttpConfiguration: HttpConfiguration = {
  shouldRefresh: (request) => !isTokenEndpoint(request),
}

/** Creates an application-scoped HTTP client with OdbVue defaults. */
export function createHttp(options: HttpConfiguration = {}): HttpClient {
  const { onSlowRequest, slowRequestThresholdMs = 3000, ...configuration } = options
  return useHttp({
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

function requestRetryOptions(options?: HttpRequestOptions): HttpRequestOptions {
  if (options?.retry !== undefined) return options
  const method = (options?.method ?? 'GET').toUpperCase()
  return { ...options, retry: ['GET', 'HEAD', 'OPTIONS'].includes(method) ? 3 : 0 }
}

async function executeRequest<T>(
  client: ReturnType<typeof $fetch.create>,
  configuration: HttpConfiguration,
  refresh: () => Promise<boolean>,
  request: string,
  options?: HttpRequestOptions,
  didRefresh = false,
): Promise<HttpResponse<T>> {
  const authenticatedRequest =
    !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(request) &&
    (configuration.openapi
      ? requiresBearerToken(configuration.openapi, options?.method ?? 'GET', request)
      : !isTokenEndpoint(request))
  try {
    const startTime = performance.now()
    const headers = new Headers(options?.headers as HeadersInit | undefined)
    const accessToken = authenticatedRequest ? configuration.getAccessToken?.() : null
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    const response = await client.raw<T, 'json' | 'blob'>(request, {
      ...requestRetryOptions(options),
      headers,
    })
    const duration = performance.now() - startTime
    if (
      typeof configuration.slowRequestThresholdMs === 'number' &&
      duration >= configuration.slowRequestThresholdMs
    ) {
      const context = { request, duration, options }
      configuration.onSlowRequest?.(context)
    }
    return {
      data:
        response._data === undefined || response._data === null
          ? null
          : configuration.openapi && options?.responseType !== 'blob'
            ? decodeOdbJson(
                configuration.openapi,
                options?.method ?? 'GET',
                request,
                response._data as T,
              )
            : (response._data as T),
      error: null,
      status: response.status,
      headers: response.headers,
    }
  } catch (error) {
    const status = getErrorStatus(error)
    const shouldRefresh =
      status === 401 &&
      authenticatedRequest &&
      !!configuration.refreshAccessToken &&
      (configuration.shouldRefresh?.(request, options) ?? true)
    if (shouldRefresh && !didRefresh) {
      const expired = new Error('session.expired')
      try {
        if (await refresh())
          return executeRequest<T>(client, configuration, refresh, request, options, true)
        const context = { request, error: expired, options }
        configuration.onRefreshFailure?.(context)
      } catch (refreshError) {
        const context = { request, error: refreshError, options }
        configuration.onRefreshFailure?.(context)
      }
    }
    const httpError = createHttpError(error, request, status)
    configuration.onError?.(httpError)
    return { data: null, error: httpError, status, headers: null }
  }
}

export function useHttp(clientOptions?: HttpClientOptions): HttpClient {
  if (!clientOptions) return http
  return createHttpClient(clientOptions)
}

export function createHttpClient(clientOptions: HttpClientOptions = {}): HttpClient {
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
      credentials: 'include',
      retry: 0,
      retryStatusCodes: [408, 425, 429, 500, 502, 503, 504],
      retryDelay,
    },
    { fetch: clientOptions.fetch },
  )
  const http = (<T>(request: string, options?: HttpRequestOptions) =>
    executeRequest<T>(client, configuration, refresh, request, options)) as HttpClient
  http.get = (url, options) =>
    executeRequest(client, configuration, refresh, url, {
      ...options,
      method: 'GET',
    })
  http.post = (url, body, options) =>
    executeRequest(client, configuration, refresh, url, {
      ...options,
      method: 'POST',
      body: body as Record<string, unknown>,
    })
  http.put = (url, body, options) =>
    executeRequest(client, configuration, refresh, url, {
      ...options,
      method: 'PUT',
      body: body as Record<string, unknown>,
    })
  http.delete = (url, options) =>
    executeRequest(client, configuration, refresh, url, {
      ...options,
      method: 'DELETE',
    })
  http.patch = (url, body, options) =>
    executeRequest(client, configuration, refresh, url, {
      ...options,
      method: 'PATCH',
      body: body as Record<string, unknown>,
    })
  http.upload = (url, file, metadata = {}, options) => {
    const headers = new Headers(options?.headers as HeadersInit | undefined)
    headers.set('Content-Type', 'application/octet-stream')
    return http.post(url, file, {
      ...options,
      headers,
      query: {
        ...options?.query,
        fileName: metadata.fileName ?? file.name,
        mimeType: metadata.mimeType ?? (file.type || 'application/octet-stream'),
        meta: JSON.stringify(metadata.meta ?? {}),
      },
    })
  }
  http.download = async (url, fileName, options = {}) => {
    const { expectedSize, ...requestOptions } = options
    const response = await http.get<Blob>(url, { ...requestOptions, responseType: 'blob' })
    if (response.error) throw response.error
    if (!response.data) throw new Error('File could not be downloaded.')
    if (
      expectedSize !== undefined &&
      (!Number.isSafeInteger(expectedSize) ||
        expectedSize < 0 ||
        response.data.size !== expectedSize)
    ) {
      throw new Error('Downloaded file size does not match.')
    }
    const anchor = document.createElement('a')
    const objectUrl = URL.createObjectURL(response.data)
    try {
      anchor.href = objectUrl
      anchor.download = fileName
      document.body.append(anchor)
      anchor.click()
    } finally {
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    }
  }
  return http
}

export const http = createHttp({
  ...appConfig.http,
  getAccessToken: () => auth.accessToken.value,
  refreshAccessToken: () => auth.refresh(),
  onError: (error) => captureError(error, { source: 'http', context: { request: error.request } }),
})
