import { $fetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'
import { useAuthStore } from '@/stores/app/auth'

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

function getAuthHeaders(): Record<string, string> {
  const authStore = useAuthStore()
  const headers: Record<string, string> = {}

  if (authStore?.accessToken) {
    headers.Authorization = `Bearer ${authStore.accessToken}`
  }

  return headers
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
    const response = await client<T>(request, {
      ...options,
      headers: {
        ...authHeaders,
        ...(options?.headers as Record<string, string>),
      },
    })
    data = response
    error = null
    status = 200
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err))
    data = null
    if (err instanceof Error && 'statusCode' in err) {
      const errorWithStatus = err as Record<string, unknown>
      status = typeof errorWithStatus.statusCode === 'number' ? errorWithStatus.statusCode : null
    } else {
      status = null
    }

    // Handle 401 errors with refresh token logic
    if (status === 401 && !request.includes('refresh/') && !request.includes('login/')) {
      const authStore = useAuthStore()

      if (!authStore) {
        return { data, error, status }
      }

      if (!isRefreshing) {
        isRefreshing = true

        try {
          const refreshed = await authStore.refresh()

          if (refreshed) {
            // Retry the original request
            const retryResult = await executeRequest<T>(client, request, options)
            isRefreshing = false

            // Process queued requests
            while (requestQueue.length > 0) {
              const queuedRequest = requestQueue.shift()
              if (queuedRequest) {
                try {
                  const result = await executeRequest(
                    client,
                    queuedRequest.request,
                    queuedRequest.options,
                  )
                  queuedRequest.resolve(result)
                } catch (queueError) {
                  queuedRequest.reject(queueError)
                }
              }
            }

            return retryResult
          } else {
            isRefreshing = false
            // Clear queue on refresh failure
            while (requestQueue.length > 0) {
              const queuedRequest = requestQueue.shift()
              if (queuedRequest) {
                queuedRequest.reject(new Error('session.expired'))
              }
            }
          }
        } catch {
          isRefreshing = false
          // Clear queue on error
          while (requestQueue.length > 0) {
            const queuedRequest = requestQueue.shift()
            if (queuedRequest) {
              queuedRequest.reject(new Error('session.expired'))
            }
          }
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
  const client = $fetch.create({
    baseURL,
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
