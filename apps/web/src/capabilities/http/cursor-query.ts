import { onScopeDispose, ref, shallowReadonly, shallowRef } from 'vue'
import type { HttpResponse } from './core.js'

export interface CursorQueryParams {
  cursor?: string
  limit: number
  search?: string
}

export interface CursorQueryOptions<Response, Item> {
  /** Receives the normalized search and the requested page size plus one lookahead row. */
  fetch: (params: CursorQueryParams & { signal: AbortSignal }) => Promise<HttpResponse<Response>>
  select: (response: Response) => readonly Item[]
  getCursor: (item: Item) => string
  /** Called only for the current request; use for optional UI feedback. */
  onError?: (error: Error) => void
}

export function useCursorQuery<Response, Item>(options: CursorQueryOptions<Response, Item>) {
  const items = shallowRef<Item[]>([])
  const nextCursor = ref<string>()
  const loading = ref(false)
  const loaded = ref(false)
  const error = shallowRef<Error>()
  let requestId = 0
  let controller: AbortController | undefined
  let disposed = false

  function cancel() {
    requestId++
    controller?.abort()
    controller = undefined
    loading.value = false
  }

  async function load(params: CursorQueryParams) {
    if (disposed) return
    cancel()
    const currentRequest = requestId
    const currentController = new AbortController()
    controller = currentController
    loading.value = true
    error.value = undefined
    items.value = []
    nextCursor.value = undefined
    let failure: Error | undefined

    try {
      if (
        !Number.isSafeInteger(params.limit) ||
        params.limit < 1 ||
        params.limit >= Number.MAX_SAFE_INTEGER
      ) {
        throw new RangeError(
          'Cursor query limit must be a positive safe integer with room for lookahead',
        )
      }
      const response = await options.fetch({
        ...params,
        limit: params.limit + 1,
        search: params.search?.trim() || undefined,
        signal: currentController.signal,
      })
      if (currentRequest !== requestId) return
      if (response.error) throw response.error
      if (response.data === null) throw new Error('Cursor query response has no data')

      const records = options.select(response.data)
      const page = records.slice(0, params.limit)
      const last = page.at(-1)
      const cursor =
        records.length > params.limit && last !== undefined ? options.getCursor(last) : undefined
      if (cursor !== undefined && !cursor)
        throw new Error('Cursor query lookahead requires a non-empty cursor')
      items.value = page
      nextCursor.value = cursor
    } catch (cause) {
      if (currentRequest !== requestId) return
      failure = cause instanceof Error ? cause : new Error(String(cause))
      error.value = failure
    } finally {
      if (currentRequest === requestId) {
        loading.value = false
        loaded.value = true
        controller = undefined
      }
    }

    if (failure) options.onError?.(failure)
  }

  onScopeDispose(() => {
    disposed = true
    cancel()
  })

  return {
    items: shallowReadonly(items),
    nextCursor: shallowReadonly(nextCursor),
    loading: shallowReadonly(loading),
    loaded: shallowReadonly(loaded),
    error: shallowReadonly(error),
    load,
    cancel,
  }
}
