import { describe, expect, it, vi } from 'vitest'
import { createOdbVueAuth } from '../src/capabilities/auth/index.js'
import type { HttpClient } from '../src/capabilities/http/index.js'

type HttpPostMock = (url: string, body?: unknown) => Promise<unknown>
type HttpGetMock = (url: string) => Promise<unknown>

function response<T>(data: T | null, status = 200) {
  return { data, error: null, status, headers: null }
}

describe('authentication capability', () => {
  it('loads the authenticated user separately from token issuance', async () => {
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
        'user-id': 7,
        username: 'ada',
        'display-name': 'Ada Lovelace',
      }),
    )
    const http = {
      post,
      get,
    } as unknown as HttpClient
    const auth = createOdbVueAuth({ http })

    await auth.login({ username: 'ada', password: 'password' })
    expect(auth.authenticated.value).toBe(false)
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

  it('normalizes kebab-case ORDS token and user responses', async () => {
    const post = vi.fn<HttpPostMock>().mockResolvedValue(
      response({
        'access-token': 'access-token',
      }),
    )
    const get = vi.fn<HttpGetMock>().mockResolvedValue(
      response({
        'user-id': 7,
        username: 'ada',
        'display-name': 'Ada Lovelace',
      }),
    )
    const auth = createOdbVueAuth({ http: { post, get } as unknown as HttpClient })

    await auth.login({ username: 'ada', password: 'password' })

    expect(auth.accessToken.value).toBe('access-token')
    expect(auth.authenticated.value).toBe(false)
    await auth.me()
    expect(auth.authenticated.value).toBe(true)
    expect(auth.user.value).toMatchObject({ id: 7, username: 'ada', displayName: 'Ada Lovelace' })
  })

  it('restores an authenticated user using the browser refresh cookie', async () => {
    const post = vi.fn<HttpPostMock>().mockResolvedValue(response({ accessToken: 'access-token' }))
    const get = vi.fn<HttpGetMock>().mockResolvedValue(response({ 'user-id': 7, username: 'ada' }))
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
    } as unknown as HttpClient
    const auth = createOdbVueAuth({ http })
    await auth.login({ username: 'ada', password: 'password' })

    await expect(auth.refresh()).resolves.toBe(false)
    expect(auth.accessToken.value).toBe('access-token')
    expect(auth.authenticated.value).toBe(false)
  })
})
