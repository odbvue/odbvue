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
  it('uploads raw bytes with encoded metadata and replays the File after refresh', async () => {
    let token = 'expired'
    const file = new File(['binary content'], 'caf\u00e9 & report.txt', { type: 'text/plain' })
    const fetch = vi.fn<FetchMock>((_input, init) =>
      Promise.resolve(
        new Headers(init?.headers).get('Authorization') === 'Bearer fresh'
          ? response(200, { id: 'file' })
          : response(401),
      ),
    )
    const http = useHttp({
      fetch,
      configuration: {
        getAccessToken: () => token,
        refreshAccessToken: async () => {
          token = 'fresh'
          return true
        },
      },
    })
    const result = await http.upload('/storage?existing=1', file, { meta: { label: 'Test' } })
    expect(result.data).toEqual({ id: 'file' })
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [request, init] of fetch.mock.calls) {
      const url = new URL(String(request), 'https://example.test')
      expect(url.searchParams.get('fileName')).toBe(file.name)
      expect(url.searchParams.get('mimeType')).toBe('text/plain')
      expect(url.searchParams.get('meta')).toBe('{"label":"Test"}')
      expect(url.searchParams.get('existing')).toBe('1')
      expect(init?.body).toBe(file)
      expect(new Headers(init?.headers).get('Content-Type')).toBe('application/octet-stream')
    }
  })

  it('saves downloaded blobs and cleans up anchors and object URLs', async () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn<typeof URL.createObjectURL>(() => 'blob:test')
    const revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>()
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createObjectURL
        static revokeObjectURL = revokeObjectURL
      },
    )
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('report.txt')
      expect(this.href).toBe('blob:test')
      expect(this.isConnected).toBe(true)
    })
    try {
      const http = useHttp({ fetch: vi.fn<FetchMock>(() => Promise.resolve(new Response('abc'))) })
      await http.download('/storage/file', 'report.txt', { expectedSize: 3 })
      expect(click).toHaveBeenCalledOnce()
      expect(document.querySelector('a[download]')).toBeNull()
      await vi.advanceTimersByTimeAsync(1000)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
      await expect(
        http.download('/storage/file', 'report.txt', { expectedSize: 4 }),
      ).rejects.toThrow('size does not match')
      expect(createObjectURL).toHaveBeenCalledOnce()
      const failed = useHttp({ fetch: vi.fn<FetchMock>(() => Promise.resolve(response(403))) })
      await expect(failed.download('/storage/file', 'report.txt')).rejects.toMatchObject({
        status: 403,
      })
      expect(createObjectURL).toHaveBeenCalledOnce()
    } finally {
      click.mockRestore()
      vi.unstubAllGlobals()
      vi.useRealTimers()
    }
  })

  it('downloads binary responses and preserves authentication through refresh', async () => {
    let token = 'expired'
    const bytes = new Uint8Array([0, 1, 127, 128, 255])
    const refreshAccessToken = vi.fn<RefreshMock>(async () => {
      token = 'fresh'
      return true
    })
    const fetch = vi.fn<FetchMock>((_input, init) =>
      Promise.resolve(
        new Headers(init?.headers).get('Authorization') === 'Bearer fresh'
          ? new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })
          : response(401),
      ),
    )
    const http = useHttp({
      fetch,
      configuration: {
        getAccessToken: () => token,
        refreshAccessToken,
        openapi: {
          paths: { '/storage/{id}': { get: { security: [{ bearerAuth: [] }] } } },
          components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
        },
      },
    })
    const result = await http.get<Blob>('/storage/file', { responseType: 'blob' })
    expect(result.error).toBeNull()
    expect(result.data?.size).toBe(bytes.length)
    expect(result.data?.type).toBe('application/octet-stream')
    expect(new Uint8Array(await result.data!.arrayBuffer())).toEqual(bytes)
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
  })

  it('inherits document security but honors anonymous operation overrides', async () => {
    const fetch = vi.fn<FetchMock>(() => Promise.resolve(response(200)))
    const http = useHttp({
      fetch,
      configuration: {
        getAccessToken: () => 'current',
        openapi: {
          security: [{ token: [] }],
          components: { securitySchemes: { token: { type: 'http', scheme: 'bearer' } } },
          paths: { '/protected': { get: {} }, '/public': { get: { security: [] } } },
        },
      },
    })
    await http.get('/protected')
    await http.get('/public')
    await http.get('/unknown')
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer current',
    )
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).has('Authorization')).toBe(false)
    expect(new Headers(fetch.mock.calls[2]?.[1]?.headers).has('Authorization')).toBe(false)
  })

  it('does not refresh authenticated requests rejected with forbidden', async () => {
    const refreshAccessToken = vi.fn<RefreshMock>(async () => true)
    const http = useHttp({
      fetch: vi.fn<FetchMock>(() => Promise.resolve(response(403))),
      configuration: { getAccessToken: () => 'current', refreshAccessToken },
    })
    expect((await http.get('/protected')).status).toBe(403)
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })
  it('uses operation security to attach tokens, preserves Headers, and skips anonymous refresh', async () => {
    const refreshAccessToken = vi.fn<RefreshMock>(async () => true)
    const fetch = vi.fn<FetchMock>(() => Promise.resolve(response(401)))
    const http = useHttp({
      fetch,
      configuration: {
        getAccessToken: () => 'current',
        refreshAccessToken,
        openapi: {
          paths: {
            '/settings/{id}': { get: { security: [{ bearerAuth: [] }] } },
            '/auth/login': { post: { security: [] } },
          },
          components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
        },
      },
    })
    await http.post('/auth/login')
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false)
    expect(refreshAccessToken).not.toHaveBeenCalled()
    await http.get('/settings/demo?value=1', { headers: new Headers({ 'X-Test': 'preserved' }) })
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer current',
    )
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get('X-Test')).toBe('preserved')
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    await http.get('https://other.example/settings/demo')
    expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).has('Authorization')).toBe(false)
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
  })
  it('parses ODB json fields using the OpenAPI document', async () => {
    const openapi = {
      paths: {
        '/sandbox/settings/{id}': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': { schema: { $ref: '#/components/schemas/Read' } },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Read: {
            type: 'object',
            properties: { value: { type: 'string' }, meta: { 'x-odb-type': 'json' } },
          },
        },
      },
    }
    const http = useHttp({
      fetch: vi.fn<FetchMock>(() =>
        Promise.resolve(response(200, { value: '1.0.0', meta: '{"label":"Version"}' })),
      ),
      configuration: { openapi },
    })

    const result = await http.get('/sandbox/settings/VERSION?x=1')

    expect(result.data).toEqual({ value: '1.0.0', meta: { label: 'Version' } })
  })
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

  it('does not refresh a failed refresh-token request', async () => {
    const refreshAccessToken = vi.fn<RefreshMock>(async () => true)
    const fetch = vi.fn<FetchMock>(() => Promise.resolve(response(401)))
    const http = useHttp({ fetch, configuration: { refreshAccessToken } })

    const result = await http.post('/auth/refresh')

    expect(result.status).toBe(401)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(refreshAccessToken).not.toHaveBeenCalled()
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
