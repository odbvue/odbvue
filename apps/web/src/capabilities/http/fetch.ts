import { shallowRef, toValue, watch } from 'vue'
import { useFormAction, type FormActionOptions } from './form-action.js'

export type FetchOptions<Response, Output> = Omit<
  FormActionOptions<void, Response, Output>,
  'method' | 'transformPayload'
>

/** Loads selected response data initially and when the endpoint changes. */
export function useFetch<Response, Output>(options: FetchOptions<Response, Output>) {
  const data = shallowRef<Output>()
  const request = useFormAction({
    ...options,
    method: 'get',
    onSuccess: async (value, input) => {
      data.value = value
      await options.onSuccess?.(value, input)
    },
  })

  watch(() => toValue(options.endpoint), () => {
    data.value = undefined
    request.reset()
    void request.action()
  }, { immediate: true, flush: 'sync' })

  return { data, loading: request.loading, error: request.error, fetch: () => request.action() }
}
