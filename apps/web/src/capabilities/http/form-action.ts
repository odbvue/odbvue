import { toValue, watch, type MaybeRefOrGetter } from 'vue'
import { http } from '../client.js'
import { useUi } from '../ui/store.js'
import { useMutation } from './mutation.js'

export interface FormActionOptions<Input, Response, Output> {
  endpoint: MaybeRefOrGetter<string>
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
  loadingKey?: string
  transformPayload?: (input: Input) => unknown
  select: (response: Response) => Output | undefined
  onSuccess?: (data: Output, input: Input) => void | Promise<void>
  messages?: {
    error?: string
    notFound?: string
    empty?: string
    success?: (data: Output, input: Input) => string
  }
}

class EmptyResponseError extends Error {}

/** Endpoint-based action wiring; forms and confirmation remain component responsibilities. */
export function useFormAction<Input, Response, Output>(
  options: FormActionOptions<Input, Response, Output>,
) {
  const ui = useUi()
  const mutation = useMutation({
    loadingKey: options.loadingKey,
    request: (input: Input) => {
      ui.clear()
      const endpoint = toValue(options.endpoint)
      const method = options.method ?? 'post'
      if (method === 'get' || method === 'delete') return http[method]<Response>(endpoint)
      return http[method]<Response>(endpoint, options.transformPayload?.(input) ?? input)
    },
    onSuccess: async (response, input) => {
      const data = response === null ? undefined : options.select(response)
      if (data === undefined)
        throw new EmptyResponseError(
          options.messages?.empty ?? options.messages?.error ?? 'Response has no data',
        )
      await options.onSuccess?.(data, input)
      const message = options.messages?.success?.(data, input)
      if (message) ui.success(message)
    },
    onError: (error) => {
      const message = error instanceof EmptyResponseError
        ? error.message
        : 'status' in error && error.status === 404
          ? options.messages?.notFound ?? options.messages?.error
          : options.messages?.error
      ui.error(message ?? error)
    },
  })

  watch(() => toValue(options.endpoint), mutation.reset, { flush: 'sync' })

  return {
    loading: mutation.loading,
    error: mutation.error,
    action: mutation.mutate,
    reset: mutation.reset,
  }
}
