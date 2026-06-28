import { $fetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'

const baseURL = import.meta.env.DEV ? '/api/' : import.meta.env.VITE_API_URI

let isRefreshing = false
const requestQueue: Array<{
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  request: string
  options?: FetchOptions<'json'>
}> = []

interface HttpResponse<T = unknown> {
  data: T | null
  error: Error | null
  status: number | null
}

interface HttpClient {
  <T>(request: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  get<T>(url: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  post<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  put<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  delete<T>(url: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  patch<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
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

const httpConfiguration: HttpConfiguration = {
  shouldRefresh: (request) => !request.includes('refresh/') && !request.includes('login/'),
}

export function configureHttp(configuration: HttpConfiguration): void {
  Object.assign(httpConfiguration, configuration)
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const accessToken = httpConfiguration.getAccessToken?.()

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return headers
}

function getErrorStatus(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null
  }

  const errorWithStatus = error as Error & {
    status?: unknown
    statusCode?: unknown
  }

  if (typeof errorWithStatus.statusCode === 'number') {
    return errorWithStatus.statusCode
  }

  if (typeof errorWithStatus.status === 'number') {
    return errorWithStatus.status
  }

  return null
}

async function flushQueuedRequests(client: ReturnType<typeof $fetch.create>): Promise<void> {
  while (requestQueue.length > 0) {
    const queuedRequest = requestQueue.shift()
    if (!queuedRequest) {
      continue
    }

    try {
      const result = await executeRequest(client, queuedRequest.request, queuedRequest.options)
      queuedRequest.resolve(result)
    } catch (queueError) {
      queuedRequest.reject(queueError)
    }
  }
}

function rejectQueuedRequests(error: Error): void {
  while (requestQueue.length > 0) {
    const queuedRequest = requestQueue.shift()
    if (queuedRequest) {
      queuedRequest.reject(error)
    }
  }
}

async function executeRequest<T>(
  client: ReturnType<typeof $fetch.create>,
  request: string,
  options?: FetchOptions<'json'>,
): Promise<HttpResponse<T>> {
  let data: T | null = null
  let error: Error | null = null
  let status: number | null = null

  try {
    const authHeaders = getAuthHeaders()
    const startTime = performance.now()
    const response = await client<T>(request, {
      ...options,
      headers: {
        ...authHeaders,
        ...(options?.headers as Record<string, string>),
        'request-startTime': startTime.toString(),
      },
    })

    // Check performance threshold
    const duration = performance.now() - startTime
    const threshold = httpConfiguration.slowRequestThresholdMs
    if (typeof threshold === 'number' && duration >= threshold) {
      httpConfiguration.onSlowRequest?.({
        request,
        duration,
        options,
      })
    }
    data = response
    error = null
    status = 200
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err))
    data = null
    status = getErrorStatus(err)

    // Handle 401 errors with refresh token logic
    const shouldRefresh =
      status === 401 &&
      !!httpConfiguration.refreshAccessToken &&
      (httpConfiguration.shouldRefresh?.(request, options) ?? true)

    if (shouldRefresh) {
      const sessionExpiredError = new Error('session.expired')

      if (!isRefreshing) {
        isRefreshing = true

        try {
          const refreshed = await httpConfiguration.refreshAccessToken?.()
          isRefreshing = false

          if (refreshed) {
            // Retry the original request
            const retryResult = await executeRequest<T>(client, request, options)
            await flushQueuedRequests(client)

            return retryResult
          } else {
            rejectQueuedRequests(sessionExpiredError)
            httpConfiguration.onRefreshFailure?.({ request, error: sessionExpiredError, options })
          }
        } catch (refreshError) {
          isRefreshing = false
          rejectQueuedRequests(sessionExpiredError)
          httpConfiguration.onRefreshFailure?.({ request, error: refreshError, options })
        }
      } else {
        // Wait for the ongoing refresh to complete
        return new Promise((resolve, reject) => {
          requestQueue.push({
            resolve: resolve as (value: unknown) => void,
            reject,
            request,
            options,
          })
        })
      }
    }
  }

  return {
    data,
    error,
    status,
  }
}

export function useHttp(): HttpClient {
  let retryCount = 0

  const client = $fetch.create({
    baseURL,
    retry: 3,
    retryStatusCodes: [500, 502, 503, 504],
    retryDelay: () => {
      retryCount++
      const base = 300 * Math.pow(2, retryCount - 1)
      const jitter = Math.random() * 150
      return base + jitter
    },
  })

  const http = async <T>(
    request: string,
    options?: FetchOptions<'json'>,
  ): Promise<HttpResponse<T>> => executeRequest<T>(client, request, options)

  http.get = async <T>(url: string, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, { ...options, method: 'GET' })

  http.post = async <T>(url: string, body?: unknown, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, {
      ...options,
      method: 'POST',
      body: body as Record<string, unknown>,
    })

  http.put = async <T>(url: string, body?: unknown, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, {
      ...options,
      method: 'PUT',
      body: body as Record<string, unknown>,
    })

  http.delete = async <T>(url: string, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, { ...options, method: 'DELETE' })

  http.patch = async <T>(url: string, body?: unknown, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, {
      ...options,
      method: 'PATCH',
      body: body as Record<string, unknown>,
    })

  return http as HttpClient
}
