import { createHttpClient, type HttpClient, type HttpClientOptions } from './core.js'
import { http } from '../runtime.js'

export * from './core.js'
export { http }

export function useHttp(clientOptions?: HttpClientOptions): HttpClient {
  return clientOptions ? createHttpClient(clientOptions) : http
}
