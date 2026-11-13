import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, isReadonly } from 'vue'
import {
  useCursorQuery,
  type CursorPage,
  type CursorQueryOptions,
} from '@/capabilities/http/cursor-query'
import type { HttpResponse } from '@/capabilities/http/core'
import { createState } from '@/capabilities/state'
import { useUi } from '@/capabilities/ui/store'

type Item = { id: string }
type Response = CursorPage<Item>
const response = (items: Item[], nextCursor?: string): HttpResponse<Response> => ({
  data: { items, nextCursor },
  error: null,
  status: 200,
  headers: null,
})
const scopes: ReturnType<typeof effectScope>[] = []

function setup(overrides: Partial<CursorQueryOptions<Item>> = {}) {
  const scope = effectScope()
  scopes.push(scope)
  const fetch = vi.fn<CursorQueryOptions<Item>['fetch']>().mockResolvedValue(response([]))
  const onError = vi.fn<(error: Error) => void>()
  const query = scope.run(() =>
    useCursorQuery({
      fetch,
      onError,
      ...overrides,
    }),
  )!
  return { query, fetch, onError, scope }
}

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
})

describe('useCursorQuery', () => {
  it('requests the displayed limit and preserves an opaque backend cursor without deriving it', async () => {
    const { query, fetch } = setup()
    expect(query.items.value).toEqual([])
    expect(query.loaded.value).toBe(false)
    expect(query.loading.value).toBe(false)
    expect(query.error.value).toBeUndefined()
    for (const state of [query.items, query.nextCursor, query.loaded, query.loading, query.error]) {
      expect(isReadonly(state)).toBe(true)
    }
    fetch.mockResolvedValue(response([{ id: 'a' }, { id: 'b' }], 'opaque-continuation'))
    expect(await query.load({ cursor: 'previous', limit: 2, search: ' ada ' })).toBe(true)
    expect(fetch).toHaveBeenCalledWith({
      cursor: 'previous',
      limit: 2,
      search: 'ada',
      signal: expect.any(AbortSignal),
    })
    expect(query.items.value).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(query.nextCursor.value).toBe('opaque-continuation')
    expect(query.loaded.value).toBe(true)
    expect(query.loading.value).toBe(false)
  })

  it.each([0, 1, 2])('has no next cursor for a terminal page of %s records', async (count) => {
    const { query, fetch } = setup()
    const items = Array.from({ length: count }, (_, index) => ({ id: String(index) }))
    fetch.mockResolvedValue(response(items))
    await query.load({ limit: 2, search: '  ' })
    expect(query.items.value).toEqual(items)
    expect(query.nextCursor.value).toBeUndefined()
    expect(fetch.mock.calls[0]?.[0].search).toBeUndefined()
  })

  it('preserves the successful page and cursor during loading and after failure', async () => {
    const { query, fetch } = setup()
    fetch.mockResolvedValueOnce(response([{ id: 'a' }], 'opaque-continuation'))
    await query.load({ limit: 1 })
    const pending = Promise.withResolvers<HttpResponse<Response>>()
    fetch.mockReturnValueOnce(pending.promise)
    const load = query.load({ cursor: 'a', limit: 1 })
    expect(query.loading.value).toBe(true)
    expect(query.items.value).toEqual([{ id: 'a' }])
    expect(query.nextCursor.value).toBe('opaque-continuation')
    pending.reject(new Error('Failed'))
    expect(await load).toBe(false)
    expect(query.items.value).toEqual([{ id: 'a' }])
    expect(query.nextCursor.value).toBe('opaque-continuation')
    fetch.mockResolvedValueOnce(response([{ id: 'b' }]))
    expect(await query.load({ cursor: 'opaque-continuation', limit: 1 })).toBe(true)
    expect(query.items.value).toEqual([{ id: 'b' }])
    expect(query.nextCursor.value).toBeUndefined()
  })

  it.each(['returned', 'rejected', 'missing data'] as const)(
    'surfaces %s failures, then clears the error on retry',
    async (kind) => {
      const { query, fetch, onError } = setup()
      const error = Object.assign(new Error('Failed'), { status: 503, request: '/list' })
      if (kind === 'rejected') fetch.mockRejectedValueOnce(error)
      else
        fetch.mockResolvedValueOnce({
          data: null,
          error: kind === 'returned' ? error : null,
          status: 503,
          headers: null,
        })
      expect(await query.load({ limit: 1 })).toBe(false)
      expect(query.error.value).toBeInstanceOf(Error)
      if (kind !== 'missing data') expect(query.error.value).toBe(error)
      expect(query.items.value).toEqual([])
      expect(query.nextCursor.value).toBeUndefined()
      expect(query.loading.value).toBe(false)
      expect(query.loaded.value).toBe(true)
      expect(onError).toHaveBeenCalledExactlyOnceWith(query.error.value)
      await query.load({ limit: 1 })
      expect(query.error.value).toBeUndefined()
      expect(onError).toHaveBeenCalledTimes(1)
    },
  )

  it.each(['success', 'returned error', 'rejection'] as const)(
    'aborts superseded requests and ignores late %s without settling the active request',
    async (kind) => {
      const { query, fetch, onError } = setup()
      const first = Promise.withResolvers<HttpResponse<Response>>()
      const second = Promise.withResolvers<HttpResponse<Response>>()
      fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      const old = query.load({ limit: 1, search: 'old' })
      const current = query.load({ limit: 1, search: 'current' })
      expect(fetch.mock.calls[0]?.[0].signal.aborted).toBe(true)
      const error = Object.assign(new Error('Old failure'), { status: 500, request: '/list' })
      if (kind === 'rejection') first.reject(error)
      else if (kind === 'returned error')
        first.resolve({ data: null, error, status: 500, headers: null })
      else first.resolve(response([{ id: 'old' }]))
      expect(await old).toBe(false)
      expect(query.loading.value).toBe(true)
      expect(query.loaded.value).toBe(false)
      expect(query.error.value).toBeUndefined()
      expect(onError).not.toHaveBeenCalled()
      second.resolve(response([{ id: 'current' }]))
      expect(await current).toBe(true)
      expect(query.items.value).toEqual([{ id: 'current' }])
    },
  )

  it.each(['cancel', 'dispose'] as const)('invalidates late responses on %s', async (action) => {
    const { query, fetch, onError, scope } = setup()
    const pending = Promise.withResolvers<HttpResponse<Response>>()
    fetch.mockReturnValueOnce(pending.promise)
    const load = query.load({ limit: 1 })
    if (action === 'cancel') query.cancel()
    else scope.stop()
    expect(fetch.mock.calls[0]?.[0].signal.aborted).toBe(true)
    expect(query.loading.value).toBe(false)
    pending.reject(new DOMException('Aborted', 'AbortError'))
    expect(await load).toBe(false)
    expect(query.items.value).toEqual([])
    expect(query.error.value).toBeUndefined()
    expect(query.loaded.value).toBe(false)
    expect(onError).not.toHaveBeenCalled()
    await query.load({ limit: 1 })
    expect(fetch).toHaveBeenCalledTimes(action === 'cancel' ? 2 : 1)
  })

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'reports invalid limit %s without fetching',
    async (limit) => {
      const { query, fetch, onError } = setup()
      await query.load({ limit })
      expect(fetch).not.toHaveBeenCalled()
      expect(query.error.value).toBeInstanceOf(RangeError)
      expect(onError).toHaveBeenCalledExactlyOnceWith(query.error.value)
      expect(query.loading.value).toBe(false)
    },
  )

  it.each([
    response([{ id: 'a' }, { id: 'b' }]),
    response([{ id: 'a' }], ''),
    response([{ id: 'a' }], '   '),
    response([], 'opaque'),
    response([{ id: 'a' }], 'previous'),
  ])('rejects invalid page contracts without publishing partial rows', async (result) => {
    const { query, fetch, onError } = setup()
    fetch.mockResolvedValueOnce(result)
    await query.load({ cursor: 'previous', limit: 1 })
    expect(query.error.value?.message).toBe('Invalid cursor page response')
    expect(onError).toHaveBeenCalledExactlyOnceWith(query.error.value)
    expect(query.items.value).toEqual([])
    expect(query.nextCursor.value).toBeUndefined()
  })

  it('does not infer exhaustion from the number of returned items', async () => {
    const { query, fetch } = setup()
    fetch.mockResolvedValueOnce(response([{ id: 'a' }], 'opaque'))
    await query.load({ limit: 5 })
    expect(query.nextCursor.value).toBe('opaque')
    fetch.mockResolvedValueOnce(response([{ id: 'b' }]))
    await query.load({ cursor: 'opaque', limit: 1 })
    expect(query.nextCursor.value).toBeUndefined()
  })

  it('integrates opt-in localized UI feedback without displaying backend messages', async () => {
    const ui = useUi(createState())
    const { query, fetch } = setup({ onError: () => ui.error('admin.loadUsersError') })
    fetch.mockRejectedValueOnce(new Error('Internal backend detail'))
    await query.load({ limit: 1 })
    expect(ui.notification.value).toMatchObject({
      type: 'error',
      message: 'admin.loadUsersError',
      presentation: 'alert',
    })
  })
})
