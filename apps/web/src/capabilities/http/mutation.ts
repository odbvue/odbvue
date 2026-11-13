import { onScopeDispose, ref, shallowReadonly, shallowRef } from 'vue'
import { useUi } from '../ui/store.js'
import type { HttpResponse } from './core.js'

export interface MutationOptions<Input, Output> {
  /** Opts into app-level loading, released on completion, reset, or scope disposal. */
  loadingKey?: string
  request: (input: Input, context: { signal: AbortSignal }) => Promise<HttpResponse<Output>>
  /** Called only for the current request; validate domain data before applying it. */
  onSuccess?: (data: Output | null, input: Input) => void
  onError?: (error: Error) => void
}

export function useMutation<Input, Output>(options: MutationOptions<Input, Output>) {
  const loading = ref(false)
  const error = shallowRef<Error>()
  let requestId = 0
  let controller: AbortController | undefined
  let disposed = false
  let stopLoading: (() => void) | undefined

  function reset() {
    requestId++
    controller?.abort()
    controller = undefined
    stopLoading?.()
    stopLoading = undefined
    loading.value = false
    error.value = undefined
  }

  async function mutate(input: Input): Promise<boolean> {
    if (disposed || loading.value) return false
    const currentRequest = ++requestId
    controller = new AbortController()
    loading.value = true
    error.value = undefined
    let failure: Error | undefined

    try {
      if (options.loadingKey !== undefined) stopLoading = useUi().loading.start(options.loadingKey)
      const response = await options.request(input, { signal: controller.signal })
      if (currentRequest !== requestId) return false
      if (response.error) throw response.error
      if (response.status === null || response.status < 200 || response.status >= 300)
        throw new Error('Mutation request failed')
      options.onSuccess?.(response.data, input)
    } catch (cause) {
      if (currentRequest !== requestId) return false
      failure = cause instanceof Error ? cause : new Error(String(cause))
      error.value = failure
    } finally {
      if (currentRequest === requestId) {
        stopLoading?.()
        stopLoading = undefined
        loading.value = false
        controller = undefined
      }
    }

    if (failure) options.onError?.(failure)
    return !failure && currentRequest === requestId
  }

  onScopeDispose(() => {
    disposed = true
    reset()
  })

  return {
    loading: shallowReadonly(loading),
    error: shallowReadonly(error),
    mutate,
    reset,
  }
}
