import { describe, expect, it, vi } from 'vitest'
import { createOdbVueAuth } from '../src/capabilities/auth/index.js'
import type { HttpClient } from '../src/capabilities/http/index.js'

type HttpPostMock = (url: string, body?: unknown) => Promise<unknown>
type HttpGetMock = (url: string) => Promise<unknown>

function response<T>(data: T | null, status = 200) {
  return { data, error: null, status, headers: null }
}

describe('authentication capability', () => {
  it('clears issued tokens if identity hydration fails during login', async () => {
    const auth = createOdbVueAuth({
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
    const auth = createOdbVueAuth({
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
    const auth = createOdbVueAuth({
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
    const auth = createOdbVueAuth({ http })

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
    const auth = createOdbVueAuth({
      http: {
        post: vi.fn<HttpPostMock>().mockResolvedValue(response(null, 401)),
      } as unknown as HttpClient,
    })

    await expect(auth.restore()).resolves.toBe(false)
    expect(auth.ready.value).toBe(true)
    expect(auth.authenticated.value).toBe(false)
  })

  it('clears an existing session when refresh returns unauthorized', async () => {
    const post = vi.fn<HttpPostMock>()
    post
      .mockResolvedValueOnce(response({ accessToken: 'access-token' }))
      .mockResolvedValueOnce(response(null, 401))
    const get = vi.fn<HttpGetMock>().mockResolvedValue(response({ userId: 7, username: 'ada' }))
    const auth = createOdbVueAuth({ http: { post, get } as unknown as HttpClient })

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
    const auth = createOdbVueAuth({ http: { post, get } as unknown as HttpClient })

    await auth.login({ username: 'ada', password: 'password' })

    expect(auth.accessToken.value).toBe('access-token')
    expect(auth.authenticated.value).toBe(true)
    expect(auth.user.value).toMatchObject({ id: 7, username: 'ada', displayName: 'Ada Lovelace' })
    expect(get).toHaveBeenCalledWith('/auth/me')
  })

  it('restores an authenticated user using the browser refresh cookie', async () => {
    const post = vi.fn<HttpPostMock>().mockResolvedValue(response({ accessToken: 'access-token' }))
    const get = vi.fn<HttpGetMock>().mockResolvedValue(response({ userId: 7, username: 'ada' }))
    const auth = createOdbVueAuth({ http: { post, get } as unknown as HttpClient })

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
    const auth = createOdbVueAuth({ http })
    await auth.login({ username: 'ada', password: 'password' })

    await expect(auth.refresh()).resolves.toBe(false)
    expect(auth.accessToken.value).toBe('access-token')
    expect(auth.authenticated.value).toBe(true)
  })
})
