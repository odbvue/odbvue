import { describe, expect, it, vi } from 'vitest'
import { useHttp } from '../src/capabilities/http/index.js'

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type RefreshMock = () => Promise<boolean>

function response(status: number, data: unknown = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HTTP capability', () => {
  it('shares one refresh and retries concurrent unauthorized requests once', async () => {
    let token = 'expired'
    const refreshAccessToken = vi.fn<RefreshMock>(async () => {
      token = 'fresh'
      return true
    })
    const fetch = vi.fn<FetchMock>((_input, init) =>
      Promise.resolve(
        new Headers(init?.headers).get('Authorization') === 'Bearer fresh'
          ? response(200, { ok: true })
          : response(401),
      ),
    )
    const http = useHttp({
      fetch,
      configuration: { getAccessToken: () => token, refreshAccessToken },
    })

    const results = await Promise.all(Array.from({ length: 10 }, () => http.get('/protected')))

    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(results.map((result) => result.status)).toEqual(Array(10).fill(200))
  })

  it('does not refresh again when the post-refresh retry remains unauthorized', async () => {
    const refreshAccessToken = vi.fn<RefreshMock>(async () => true)
    const http = useHttp({
      fetch: vi.fn<FetchMock>(() => Promise.resolve(response(401))),
      configuration: { refreshAccessToken },
    })

    const result = await http.get('/protected')

    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(401)
  })

  it('retries retryable GET responses', async () => {
    let attempts = 0
    const http = useHttp({
      fetch: vi.fn<FetchMock>(() =>
        Promise.resolve(attempts++ < 2 ? response(503) : response(200)),
      ),
    })

    const result = await http.get('/read', { retryDelay: 0 })

    expect(attempts).toBe(3)
    expect(result.status).toBe(200)
  })

  it('does not retry POST responses by default', async () => {
    const fetch = vi.fn<FetchMock>(() => Promise.resolve(response(503)))
    const http = useHttp({ fetch })

    const result = await http.post('/write', { value: true })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(503)
  })

  it('retries GET network failures', async () => {
    let attempts = 0
    const http = useHttp({
      fetch: vi.fn<FetchMock>(() => {
        attempts += 1
        return attempts === 1
          ? Promise.reject(new TypeError('Network unavailable'))
          : Promise.resolve(response(200))
      }),
    })

    const result = await http.get('/read', { retryDelay: 0 })

    expect(attempts).toBe(2)
    expect(result.status).toBe(200)
  })

  it('honors Retry-After before retrying', async () => {
    vi.useFakeTimers()
    let attempts = 0
    const fetch = vi.fn<FetchMock>(() => {
      attempts += 1
      return Promise.resolve(
        attempts === 1
          ? new Response(JSON.stringify({}), { status: 429, headers: { 'Retry-After': '2' } })
          : response(200),
      )
    })
    const http = useHttp({ fetch })

    const request = http.get('/rate-limited', { retry: 1 })
    await vi.advanceTimersByTimeAsync(1_999)
    expect(attempts).toBe(1)
    await vi.advanceTimersByTimeAsync(1)

    await expect(request).resolves.toMatchObject({ status: 200 })
    expect(attempts).toBe(2)
    vi.useRealTimers()
  })
})
