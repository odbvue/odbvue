import { describe, expect, it, vi } from 'vitest'
import { createAuth } from '@/capabilities/auth/core.js'
import { createHttpClient, type HttpClient } from '@/capabilities/http/core.js'

type HttpPostMock = (url: string, body?: unknown) => Promise<unknown>
type HttpGetMock = (url: string) => Promise<unknown>

function response<T>(data: T | null, status = 200) {
  return { data, error: null, status, headers: null }
}

describe('authentication capability', () => {
  it.each([true, false])('reads the anonymous Google configuration (%s)', async (enabled) => {
    const http: Pick<HttpClient, 'get' | 'post'> = createHttpClient()
    const get = vi.spyOn(http, 'get').mockResolvedValue(response({ enabled }))
    const auth = createAuth({ http })
    await expect(auth.getGoogleConfig()).resolves.toEqual({ enabled })
    expect(get).toHaveBeenCalledWith('/auth/google/config', { credentials: 'omit' })
    expect(auth.accessToken.value).toBeNull()
  })

  it('surfaces failed or malformed Google configuration rather than disabling silently', async () => {
    const http: Pick<HttpClient, 'get' | 'post'> = createHttpClient()
    const get = vi.spyOn(http, 'get')
    get
      .mockResolvedValueOnce({
        ...response(null, 503),
        error: Object.assign(new Error('Unavailable'), {
          status: 503,
          request: '/auth/google/config',
        }),
      })
      .mockResolvedValueOnce(response({ enabled: 'false' }))
    const auth = createAuth({ http })
    await expect(auth.getGoogleConfig()).rejects.toThrow('Unavailable')
    await expect(auth.getGoogleConfig()).rejects.toThrow('configuration')
  })

  it('starts backend-owned Google authorization with the transaction cookie', async () => {
    const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=server-state'
    const http: Pick<HttpClient, 'get' | 'post'> = createHttpClient()
    const post = vi.spyOn(http, 'post').mockResolvedValue(response({ authorizationUrl }))
    const auth = createAuth({ http })
    await expect(auth.startGoogleLogin({ redirect: '/sandbox' })).resolves.toEqual({
      authorizationUrl,
    })
    expect(post).toHaveBeenCalledWith(
      '/auth/google/start',
      { redirect: '/sandbox' },
      { credentials: 'include' },
    )
    expect(auth.accessToken.value).toBeNull()
    expect(auth.user.value).toBeNull()
    expect(auth.loading.value).toBe(false)
  })

  it.each([
    'https://evil.example/o/oauth2/v2/auth',
    'https://accounts.google.com.evil.example/o/oauth2/v2/auth',
    'http://accounts.google.com/o/oauth2/v2/auth',
    'https://accounts.google.com/other',
    'https://accounts.google.com:444/o/oauth2/v2/auth',
    'https://user:password@accounts.google.com/o/oauth2/v2/auth',
    '/o/oauth2/v2/auth',
    'javascript:alert(1)',
    '',
  ])('rejects unsafe Google navigation: %s', async (authorizationUrl) => {
    const http: Pick<HttpClient, 'get' | 'post'> = createHttpClient()
    vi.spyOn(http, 'post').mockResolvedValue(response({ authorizationUrl }))
    const auth = createAuth({ http })
    await expect(auth.startGoogleLogin()).rejects.toThrow()
    expect(auth.loading.value).toBe(false)
    expect(auth.accessToken.value).toBeNull()
  })

  it('releases loading state after Google start failures', async () => {
    const http: Pick<HttpClient, 'get' | 'post'> = createHttpClient()
    const post = vi.spyOn(http, 'post')
    post
      .mockResolvedValueOnce({
        ...response(null, 429),
        error: Object.assign(new Error('Too many requests'), {
          status: 429,
          request: '/auth/google/start',
        }),
      })
      .mockResolvedValueOnce(response({}))
    const auth = createAuth({ http })
    await expect(auth.startGoogleLogin()).rejects.toThrow('Too many requests')
    await expect(auth.startGoogleLogin()).rejects.toThrow('Unable to start Google sign-in')
    expect(auth.loading.value).toBe(false)
  })

  it('clears issued tokens if identity hydration fails during login', async () => {
    const auth = createAuth({
      http: {
        post: vi.fn<HttpPostMock>().mockResolvedValue(response({ accessToken: 'access-token' })),
        get: vi.fn<HttpGetMock>().mockResolvedValue({
          ...response(null, 403),
          error: new Error('Forbidden'),
        }),
      } as unknown as HttpClient,
    })

    await expect(auth.login({ username: 'ada', password: 'password' })).rejects.toThrow('Forbidden')
    expect(auth.accessToken.value).toBeNull()
    expect(auth.user.value).toBeNull()
    expect(auth.loading.value).toBe(false)
  })

  it('surfaces logout errors and clears the local session', async () => {
    const post = vi.fn<HttpPostMock>()
    post
      .mockResolvedValueOnce(response({ accessToken: 'access-token' }))
      .mockResolvedValueOnce({ ...response(null, 500), error: new Error('Logout failed') })
    const auth = createAuth({
      http: {
        post,
        get: vi.fn<HttpGetMock>().mockResolvedValue(response({ userId: 7, username: 'ada' })),
      } as unknown as HttpClient,
    })
    await auth.login({ username: 'ada', password: 'password' })

    await expect(auth.logout()).rejects.toThrow('Logout failed')
    expect(auth.accessToken.value).toBeNull()
    expect(auth.user.value).toBeNull()
    expect(auth.loading.value).toBe(false)
  })

  it('hydrates roles and permissions from JSON text or decoded arrays', async () => {
    const auth = createAuth({
      http: {
        get: vi.fn<HttpGetMock>().mockResolvedValue(
          response({
            userId: 7,
            username: 'ada',
            roles: '["admin"]',
            permissions: ['settings.read'],
          }),
        ),
      } as unknown as HttpClient,
    })
    await auth.me()
    expect(auth.hasRole('admin')).toBe(true)
    expect(auth.can('settings.read')).toBe(true)
    expect(auth.can('settings.write')).toBe(false)
  })
  it('hydrates the authenticated user after token issuance', async () => {
    const post = vi.fn<HttpPostMock>()
    post
      .mockResolvedValueOnce(
        response({
          accessToken: 'access-token',
        }),
      )
      .mockResolvedValueOnce(
        response({
          accessToken: 'next-access-token',
        }),
      )
    const get = vi.fn<HttpGetMock>().mockResolvedValue(
      response({
        userId: 7,
        username: 'ada',
        displayName: 'Ada Lovelace',
      }),
    )
    const http = {
      post,
      get,
    } as unknown as HttpClient
    const auth = createAuth({ http })

    await auth.login({ username: 'ada', password: 'password' })
    expect(http.post).toHaveBeenNthCalledWith(
      1,
      '/auth/login',
      { username: 'ada', password: 'password' },
      { credentials: 'include' },
    )
    expect(auth.authenticated.value).toBe(true)
    expect(auth.user.value?.username).toBe('ada')
    await expect(auth.refresh()).resolves.toBe(true)
    await expect(auth.me()).resolves.toMatchObject({ id: 7, username: 'ada' })

    expect(auth.authenticated.value).toBe(true)
    expect(auth.user.value?.username).toBe('ada')
    expect(auth.hasRole('developer')).toBe(false)
    expect(auth.can('orders.write')).toBe(false)
    expect(http.get).toHaveBeenCalledWith('/auth/me')
    expect(http.post).toHaveBeenLastCalledWith('/auth/refresh', undefined, {
      credentials: 'include',
    })
  })

  it('becomes ready anonymously when the refresh cookie is invalid', async () => {
    const auth = createAuth({
      http: {
        post: vi.fn<HttpPostMock>().mockResolvedValue(response(null, 401)),
        get: vi.fn<HttpGetMock>(),
      } as unknown as HttpClient,
    })

    await expect(auth.restore()).resolves.toBe(false)
    expect(auth.ready.value).toBe(true)
    expect(auth.authenticated.value).toBe(false)
  })

  it('shares one lazy restoration across concurrent calls and later navigations', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>()
    fetch
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ userId: 7, username: 'ada' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    const auth = createAuth({ http: createHttpClient({ fetch }) })
    expect(fetch).not.toHaveBeenCalled()

    const first = auth.restore()
    const second = auth.restore()
    expect(second).toBe(first)
    expect(auth.ready.value).toBe(false)
    finish(
      new Response(JSON.stringify({ accessToken: 'restored-token' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(first).resolves.toBe(true)
    expect(auth.restore()).toBe(first)
    await expect(auth.restore()).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(auth.ready.value).toBe(true)
  })

  it('shares restoration failures instead of silently retrying or hanging', async () => {
    const error = new Error('Identity unavailable')
    const fetch = vi.fn<typeof globalThis.fetch>()
    fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'restored-token' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValue(new Response(null, { status: 403 }))
    const http = createHttpClient({ fetch })
    const auth = createAuth({ http })
    vi.spyOn(auth, 'me').mockRejectedValue(error)
    const first = auth.restore()
    await expect(first).rejects.toBe(error)
    expect(auth.restore()).toBe(first)
    await expect(auth.restore()).rejects.toBe(error)
    expect(auth.ready.value).toBe(true)
  })

  it('clears an existing session when refresh returns unauthorized', async () => {
    const post = vi.fn<HttpPostMock>()
    post
      .mockResolvedValueOnce(response({ accessToken: 'access-token' }))
      .mockResolvedValueOnce(response(null, 401))
    const get = vi.fn<HttpGetMock>().mockResolvedValue(response({ userId: 7, username: 'ada' }))
    const auth = createAuth({ http: { post, get } as unknown as HttpClient })

    await auth.login({ username: 'ada', password: 'password' })
    await expect(auth.refresh()).resolves.toBe(false)

    expect(auth.accessToken.value).toBeNull()
    expect(auth.authenticated.value).toBe(false)
  })

  it('consumes camelCase ORDS token and user responses', async () => {
    const post = vi.fn<HttpPostMock>().mockResolvedValue(
      response({
        accessToken: 'access-token',
      }),
    )
    const get = vi.fn<HttpGetMock>().mockResolvedValue(
      response({
        userId: 7,
        username: 'ada',
        displayName: 'Ada Lovelace',
      }),
    )
    const auth = createAuth({ http: { post, get } as unknown as HttpClient })

    await auth.login({ username: 'ada', password: 'password' })

    expect(auth.accessToken.value).toBe('access-token')
    expect(auth.authenticated.value).toBe(true)
    expect(auth.user.value).toMatchObject({ id: 7, username: 'ada', displayName: 'Ada Lovelace' })
    expect(get).toHaveBeenCalledWith('/auth/me')
  })

  it('restores an authenticated user using the browser refresh cookie', async () => {
    const post = vi.fn<HttpPostMock>().mockResolvedValue(response({ accessToken: 'access-token' }))
    const get = vi.fn<HttpGetMock>().mockResolvedValue(response({ userId: 7, username: 'ada' }))
    const auth = createAuth({ http: { post, get } as unknown as HttpClient })

    await expect(auth.restore()).resolves.toBe(true)

    expect(auth.ready.value).toBe(true)
    expect(auth.authenticated.value).toBe(true)
    expect(post).toHaveBeenCalledWith('/auth/refresh', undefined, { credentials: 'include' })
    expect(get).toHaveBeenCalledWith('/auth/me')
  })

  it('preserves the session when refresh fails without an HTTP response', async () => {
    const post = vi.fn<HttpPostMock>()
    post
      .mockResolvedValueOnce(
        response({
          accessToken: 'access-token',
        }),
      )
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Offline'),
        status: null,
        headers: null,
      })
    const http = {
      post,
      get: vi.fn<HttpGetMock>().mockResolvedValue(response({ userId: 7, username: 'ada' })),
    } as unknown as HttpClient
    const auth = createAuth({ http })
    await auth.login({ username: 'ada', password: 'password' })

    await expect(auth.refresh()).resolves.toBe(false)
    expect(auth.accessToken.value).toBe('access-token')
    expect(auth.authenticated.value).toBe(true)
  })
})
