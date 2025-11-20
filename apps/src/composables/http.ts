import { $fetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'

const baseURL = import.meta.env.DEV ? '/api/' : import.meta.env.VITE_API_URI

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

async function executeRequest<T>(
  client: ReturnType<typeof $fetch.create>,
  request: string,
  options?: FetchOptions<'json'>,
): Promise<HttpResponse<T>> {
  let data: T | null = null
  let error: Error | null = null
  let status: number | null = null

  try {
    const response = await client<T>(request, options)
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
