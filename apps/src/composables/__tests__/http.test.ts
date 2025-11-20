import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ofetch', () => {
  const mockCreate = vi.fn((options) => ({
    ...options,
    __isMocked: true,
  }))
  return {
    $fetch: {
      create: mockCreate,
    },
  }
})

import { useHttp } from '../http'
import { $fetch } from 'ofetch'

describe('useHttp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a fetch instance', () => {
    const http = useHttp()
    expect(http).toBeDefined()
    expect(typeof http).toBe('function')
    expect(http.get).toBeDefined()
    expect(http.post).toBeDefined()
    expect(http.put).toBeDefined()
    expect(http.delete).toBeDefined()
    expect(http.patch).toBeDefined()
  })

  it('creates instance with baseURL configuration', () => {
    vi.mocked($fetch.create).mockClear()
    useHttp()
    expect(vi.mocked($fetch.create)).toHaveBeenCalledOnce()
    const callArgs = vi.mocked($fetch.create).mock.calls[0]?.[0]
    expect(callArgs).toHaveProperty('baseURL')
  })

  it('returns same type instance on multiple calls', () => {
    const http1 = useHttp()
    const http2 = useHttp()
    expect(typeof http1).toBe(typeof http2)
  })
})
