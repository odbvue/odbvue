import { afterEach, describe, expect, it, vi } from 'vitest'

type CaptureError = typeof import('@/capabilities/errors').captureError

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.doUnmock('@/capabilities/config')
  vi.doUnmock('@/capabilities/errors')
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('auth and HTTP module boundaries', () => {
  it('imports and constructs core factories without application configuration or error services', async () => {
    vi.doMock('@/capabilities/config', () => {
      throw new Error('Core factories must not load application configuration.')
    })
    vi.doMock('@/capabilities/errors', () => {
      throw new Error('Core factories must not load application error services.')
    })
    const { createAuth } = await import('@/capabilities/auth/core.js')
    const { createHttp, createHttpClient } = await import('@/capabilities/http/core.js')
    const fetch = vi.fn<typeof globalThis.fetch>()
    const http = createHttpClient({ fetch })
    const auth = createAuth({ http })

    expect(auth.authenticated.value).toBe(false)
    expect(createHttp().get).toBeTypeOf('function')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['auth', 'http'] as const)(
    'initializes shared instances lazily when importing %s first',
    async (first) => {
      vi.doMock('@/capabilities/config', () => ({ appConfig: {} }))
      vi.doMock('@/capabilities/errors', () => ({ captureError: vi.fn<CaptureError>() }))
      const fetch = vi.fn<typeof globalThis.fetch>()
      vi.stubGlobal('fetch', fetch)

      if (first === 'auth') await import('@/capabilities/auth/index.js')
      else await import('@/capabilities/http/index.js')
      const authModule = await import('@/capabilities/auth/index.js')
      const httpModule = await import('@/capabilities/http/index.js')
      const runtime = await import('@/capabilities/runtime.js')
      const authCore = await import('@/capabilities/auth/core.js')
      const httpCore = await import('@/capabilities/http/core.js')

      expect(authModule.auth).toBe(runtime.auth)
      expect(authModule.useAuth()).toBe(runtime.auth)
      expect(httpModule.http).toBe(runtime.http)
      expect(httpModule.useHttp()).toBe(runtime.http)
      expect(authModule.createAuth).toBe(authCore.createAuth)
      expect(httpModule.createHttp).toBe(httpCore.createHttp)
      expect(httpModule.createHttpClient).toBe(httpCore.createHttpClient)
      expect(httpModule.useHttp({ fetch })).not.toBe(runtime.http)
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it('wires login, shared refresh, logout, and error reporting through the same client', async () => {
    vi.doMock('@/capabilities/config', () => ({ appConfig: {} }))
    const captureError = vi.fn<CaptureError>()
    vi.doMock('@/capabilities/errors', () => ({ captureError }))
    let requiredToken = 'login-token'
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const path = new URL(String(input), 'https://example.test').pathname
      if (path.endsWith('/auth/login')) return json({ accessToken: 'login-token' })
      if (path.endsWith('/auth/refresh')) return json({ accessToken: 'fresh-token' })
      if (path.endsWith('/auth/logout')) return json({})
      if (new Headers(init?.headers).get('Authorization') !== `Bearer ${requiredToken}`)
        return json({}, 401)
      if (path.endsWith('/auth/me')) return json({ userId: 7, username: 'ada' })
      return json({ ok: true })
    })
    vi.stubGlobal('fetch', fetch)
    const { auth } = await import('@/capabilities/auth/index.js')
    const { http } = await import('@/capabilities/http/index.js')

    await auth.login({ username: 'ada', password: 'password' })
    expect(auth.authenticated.value).toBe(true)
    expect(auth.user.value?.username).toBe('ada')
    requiredToken = 'fresh-token'
    const results = await Promise.all([http.get('/protected'), http.get('/protected')])
    expect(results.map((result) => result.data)).toEqual([{ ok: true }, { ok: true }])
    expect(auth.accessToken.value).toBe('fresh-token')
    expect(
      fetch.mock.calls.filter(([input]) => String(input).endsWith('/auth/refresh')),
    ).toHaveLength(1)
    await auth.logout()
    expect(auth.authenticated.value).toBe(false)
    expect(auth.accessToken.value).toBeNull()
    for (const [input, init] of fetch.mock.calls) {
      if (/\/auth\/(?:login|refresh|logout)$/.test(String(input)))
        expect(new Headers(init?.headers).has('Authorization')).toBe(false)
      expect(init?.credentials).toBe('include')
    }
    expect(captureError).not.toHaveBeenCalled()

    fetch.mockResolvedValue(json({}, 401))
    const failed = await http.get('/protected')
    expect(failed.status).toBe(401)
    expect(
      fetch.mock.calls.filter(([input]) => String(input).endsWith('/auth/refresh')),
    ).toHaveLength(2)
    expect(captureError).toHaveBeenCalledWith(failed.error, {
      source: 'http',
      context: { request: '/protected' },
    })
  })
})
