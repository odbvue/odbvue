import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, isReadonly } from 'vue'
import { useMutation, type MutationOptions } from '@/capabilities/http/mutation'
import type { HttpResponse } from '@/capabilities/http/core'
import { useUi } from '@/capabilities/ui/store'

type Input = { id: string; enabled: boolean }
type Output = { id: string; enabled: boolean }
const input: Input = { id: 'a', enabled: false }
const response = (data: Output | null = input, status = 200): HttpResponse<Output> => ({
  data,
  error: null,
  status,
  headers: null,
})
const scopes: ReturnType<typeof effectScope>[] = []
const ui = useUi()

function setup(overrides: Partial<MutationOptions<Input, Output>> = {}) {
  const scope = effectScope()
  scopes.push(scope)
  const request = vi.fn<MutationOptions<Input, Output>['request']>().mockResolvedValue(response())
  const onSuccess = vi.fn<NonNullable<MutationOptions<Input, Output>['onSuccess']>>()
  const onError = vi.fn<(error: Error) => void>()
  const mutation = scope.run(() =>
    useMutation({ loadingKey: 'test.mutation', request, onSuccess, onError, ...overrides }),
  )!
  return { mutation, request, onSuccess, onError, scope }
}

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  expect(ui.loading.active.value).toBe(false)
})

describe('useMutation', () => {
  it('exposes readonly state and sends input and an abort signal to the request', async () => {
    const { mutation, request, onSuccess, onError } = setup()
    expect(mutation.loading.value).toBe(false)
    expect(mutation.error.value).toBeUndefined()
    expect(isReadonly(mutation.loading)).toBe(true)
    expect(isReadonly(mutation.error)).toBe(true)
    expect(await mutation.mutate(input)).toBe(true)
    expect(request).toHaveBeenCalledExactlyOnceWith(input, { signal: expect.any(AbortSignal) })
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(input, input)
    expect(onError).not.toHaveBeenCalled()
    expect(mutation.loading.value).toBe(false)
  })

  it('rejects overlapping submissions without aborting or duplicating the active mutation', async () => {
    const { mutation, request, onSuccess } = setup()
    const pending = Promise.withResolvers<HttpResponse<Output>>()
    request.mockReturnValueOnce(pending.promise)
    const first = mutation.mutate(input)
    expect(mutation.loading.value).toBe(true)
    expect(ui.loading.has('test.mutation')).toBe(true)
    expect(await mutation.mutate({ ...input, enabled: true })).toBe(false)
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]?.[1].signal.aborted).toBe(false)
    pending.resolve(response())
    expect(await first).toBe(true)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(mutation.loading.value).toBe(false)
    expect(ui.loading.active.value).toBe(false)
    expect(await mutation.mutate(input)).toBe(true)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('accepts a successful no-content response', async () => {
    const { mutation, request, onSuccess } = setup()
    request.mockResolvedValueOnce(response(null, 204))
    expect(await mutation.mutate(input)).toBe(true)
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(null, input)
  })

  it.each([
    'returned',
    'rejected',
    'non-error rejection',
    'invalid status',
    'missing status',
  ] as const)(
    'reports %s failures without automatic retries and clears errors on retry',
    async (kind) => {
      const { mutation, request, onSuccess, onError } = setup()
      const error = Object.assign(new Error('Failed'), { status: 503, request: '/status' })
      if (kind === 'rejected') request.mockRejectedValueOnce(error)
      else if (kind === 'non-error rejection') request.mockRejectedValueOnce('Failed')
      else if (kind === 'returned') request.mockResolvedValueOnce({ ...response(null, 503), error })
      else if (kind === 'missing status')
        request.mockResolvedValueOnce({ ...response(null), status: null })
      else request.mockResolvedValueOnce(response(null, 503))
      expect(await mutation.mutate(input)).toBe(false)
      expect(mutation.error.value).toBeInstanceOf(Error)
      if (kind === 'returned' || kind === 'rejected') expect(mutation.error.value).toBe(error)
      expect(onError).toHaveBeenCalledExactlyOnceWith(mutation.error.value)
      expect(onSuccess).not.toHaveBeenCalled()
      expect(request).toHaveBeenCalledTimes(1)
      expect(mutation.loading.value).toBe(false)
      expect(await mutation.mutate(input)).toBe(true)
      expect(mutation.error.value).toBeUndefined()
      expect(onError).toHaveBeenCalledTimes(1)
    },
  )

  it('surfaces domain validation failures from onSuccess', async () => {
    const error = new Error('Missing user')
    const { mutation, request, onError } = setup({
      onSuccess(data) {
        if (!data) throw error
      },
    })
    request.mockResolvedValueOnce(response(null))
    expect(await mutation.mutate(input)).toBe(false)
    expect(mutation.error.value).toBe(error)
    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    mutation.reset()
    expect(mutation.error.value).toBeUndefined()
  })

  it.each(['success', 'returned error', 'rejection'] as const)(
    'ignores late %s after reset without settling a newer mutation',
    async (kind) => {
      const { mutation, request, onSuccess, onError } = setup()
      const first = Promise.withResolvers<HttpResponse<Output>>()
      const second = Promise.withResolvers<HttpResponse<Output>>()
      request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      const old = mutation.mutate(input)
      mutation.reset()
      expect(request.mock.calls[0]?.[1].signal.aborted).toBe(true)
      expect(mutation.loading.value).toBe(false)
      expect(ui.loading.active.value).toBe(false)
      const current = mutation.mutate({ ...input, id: 'b' })
      const error = Object.assign(new Error('Old failure'), { status: 500, request: '/status' })
      if (kind === 'rejection') first.reject(error)
      else if (kind === 'returned error') first.resolve({ ...response(null, 500), error })
      else first.resolve(response())
      expect(await old).toBe(false)
      expect(mutation.loading.value).toBe(true)
      expect(ui.loading.has('test.mutation')).toBe(true)
      expect(mutation.error.value).toBeUndefined()
      expect(onSuccess).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
      second.resolve(response({ ...input, id: 'b' }))
      expect(await current).toBe(true)
      expect(mutation.loading.value).toBe(false)
      expect(ui.loading.active.value).toBe(false)
      expect(onSuccess).toHaveBeenCalledExactlyOnceWith(
        { ...input, id: 'b' },
        { ...input, id: 'b' },
      )
    },
  )

  it.each(['success', 'rejection'] as const)(
    'aborts on scope disposal and ignores late %s and later submissions',
    async (kind) => {
      const { mutation, request, onSuccess, onError, scope } = setup()
      const pending = Promise.withResolvers<HttpResponse<Output>>()
      request.mockReturnValueOnce(pending.promise)
      const running = mutation.mutate(input)
      scope.stop()
      expect(request.mock.calls[0]?.[1].signal.aborted).toBe(true)
      expect(mutation.loading.value).toBe(false)
      expect(ui.loading.active.value).toBe(false)
      if (kind === 'success') pending.resolve(response())
      else pending.reject(new DOMException('Aborted', 'AbortError'))
      expect(await running).toBe(false)
      expect(mutation.error.value).toBeUndefined()
      expect(onSuccess).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
      expect(await mutation.mutate(input)).toBe(false)
      expect(request).toHaveBeenCalledTimes(1)
    },
  )

  it('does not use app loading unless a loading key is provided', async () => {
    const { mutation, request } = setup({ loadingKey: undefined })
    const pending = Promise.withResolvers<HttpResponse<Output>>()
    request.mockReturnValueOnce(pending.promise)
    const running = mutation.mutate(input)
    expect(mutation.loading.value).toBe(true)
    expect(ui.loading.active.value).toBe(false)
    pending.resolve(response())
    expect(await running).toBe(true)
  })

  it('keeps other mutations with the same loading key active when one resets or finishes', async () => {
    const first = setup()
    const second = setup()
    const old = Promise.withResolvers<HttpResponse<Output>>()
    const current = Promise.withResolvers<HttpResponse<Output>>()
    first.request.mockReturnValueOnce(old.promise)
    second.request.mockReturnValueOnce(current.promise)
    const oldRequest = first.mutation.mutate(input)
    const currentRequest = second.mutation.mutate(input)
    first.mutation.reset()
    expect(ui.loading.has('test.mutation')).toBe(true)
    old.resolve(response())
    expect(await oldRequest).toBe(false)
    expect(ui.loading.has('test.mutation')).toBe(true)
    current.resolve(response())
    expect(await currentRequest).toBe(true)
    expect(ui.loading.active.value).toBe(false)
  })

  it('surfaces an invalid loading key without starting the request', async () => {
    const { mutation, request, onError } = setup({ loadingKey: ' ' })
    expect(await mutation.mutate(input)).toBe(false)
    expect(request).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'A loading operation key is required.' }),
    )
    expect(ui.loading.active.value).toBe(false)
  })
})
