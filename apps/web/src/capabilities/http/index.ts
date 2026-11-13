import { createHttpClient, type HttpClient, type HttpClientOptions } from './core.js'
import { http } from '../client.js'

export * from './core.js'
export {
  useCursorQuery,
  type CursorPage,
  type CursorQueryParams,
  type CursorQueryOptions,
} from './cursor-query.js'
export { useMutation, type MutationOptions } from './mutation.js'
export { http }

export function useHttp(clientOptions?: HttpClientOptions): HttpClient {
  return clientOptions ? createHttpClient(clientOptions) : http
}
