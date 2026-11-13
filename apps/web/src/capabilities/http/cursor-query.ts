import { onScopeDispose, ref, shallowReadonly, shallowRef } from 'vue'
import type { HttpResponse } from './core.js'

export interface CursorQueryParams {
  cursor?: string
  limit: number
  search?: string
}

export interface CursorPage<Item> {
  items: Item[]
  nextCursor?: string
}

export interface CursorQueryOptions<Item> {
  /** Receives the displayed page size; continuation is owned by the server. */
  fetch: (
    params: CursorQueryParams & { signal: AbortSignal },
  ) => Promise<HttpResponse<CursorPage<Item>>>
  /** Called only for the current request; use for optional UI feedback. */
  onError?: (error: Error) => void
}

export function useCursorQuery<Item>(options: CursorQueryOptions<Item>) {
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

  async function load(params: CursorQueryParams): Promise<boolean> {
    if (disposed) return false
    cancel()
    const currentRequest = requestId
    const currentController = new AbortController()
    controller = currentController
    loading.value = true
    error.value = undefined
    let failure: Error | undefined

    try {
      if (!Number.isSafeInteger(params.limit) || params.limit < 1) {
        throw new RangeError('Cursor query limit must be a positive safe integer')
      }
      const response = await options.fetch({
        ...params,
        limit: params.limit,
        search: params.search?.trim() || undefined,
        signal: currentController.signal,
      })
      if (currentRequest !== requestId) return false
      if (response.error) throw response.error
      if (response.data === null) throw new Error('Cursor query response has no data')

      const page = response.data
      if (
        !Array.isArray(page.items) ||
        page.items.length > params.limit ||
        (page.nextCursor !== undefined &&
          (typeof page.nextCursor !== 'string' ||
            !page.nextCursor.trim() ||
            !page.items.length ||
            page.nextCursor === params.cursor))
      )
        throw new Error('Invalid cursor page response')
      items.value = page.items
      nextCursor.value = page.nextCursor
    } catch (cause) {
      if (currentRequest !== requestId) return false
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
    return !failure && currentRequest === requestId
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
