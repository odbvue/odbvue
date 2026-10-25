import { describe, expect, it, vi } from 'vitest'
import { createAuth as createCoreAuth, type AuthOptions } from '@/capabilities/auth/core'
import { createLoading } from '@/capabilities/ui/loading'
import { createHttpClient } from '@/capabilities/http/core'
import { authState } from '../auth-state'

const challenge = 'A'.repeat(64)
const setupSecret = 'ABCDEFGHIJKLMNOP234567ABCDEFGHIJKLMNOP'.slice(0, 32)
const codes = Array.from({ length: 10 }, (_, index) => String(index).padStart(32, '0'))
const credentials = { username: 'ada', password: 'password' }
const loading = createLoading()
function createAuth(options: AuthOptions) {
  return createCoreAuth({ ...options, onOperation: (operation) => loading.start(operation) })
}

function response<T>(data: T) {
  return { data, error: null, status: 200, headers: null }
}

function setup() {
  const http = createHttpClient()
  const post = vi.spyOn(http, 'post')
  const get = vi
    .spyOn(http, 'get')
    .mockResolvedValue(response(authState({ userId: 7, username: 'ada' })))
  return { auth: createAuth({ http }), post, get }
}

describe('two-factor authentication client', () => {
  it.each([null, setupSecret])(
    'returns a restricted login challenge without applying tokens or loading a profile (%s)',
    async (secret) => {
      const { auth, post, get } = setup()
      post.mockResolvedValue(response({ accessToken: null, challenge, setupSecret: secret }))
      await expect(auth.login(credentials)).resolves.toEqual({ challenge, setupSecret: secret })
      expect(auth.accessToken.value).toBeNull()
      expect(auth.user.value).toBeNull()
      expect(auth.authenticated.value).toBe(false)
      expect(loading.active.value).toBe(false)
      expect(get).not.toHaveBeenCalled()
      expect(post).toHaveBeenCalledWith('/auth/login', credentials, { credentials: 'include' })
    },
  )

  it.each([
    {},
    { accessToken: null, challenge: 'not-a-token' },
    { accessToken: 'unexpected-token', challenge },
    { accessToken: null, challenge, setupSecret: 'invalid' },
  ])('rejects malformed login responses without authenticating', async (body) => {
    const { auth, post, get } = setup()
    post.mockResolvedValue(response(body))
    await expect(auth.login(credentials)).rejects.toThrow()
    expect(auth.accessToken.value).toBeNull()
    expect(auth.authenticated.value).toBe(false)
    expect(get).not.toHaveBeenCalled()
  })

  it.each([[], codes, JSON.stringify(codes)])(
    'authenticates only after verification and decodes recovery codes',
    async (recoveryCodes) => {
      const { auth, post, get } = setup()
      post.mockResolvedValue(response({ accessToken: 'verified-token', recoveryCodes }))
      await expect(auth.verifyTwoFactor(challenge, '123456')).resolves.toEqual({
        recoveryCodes: typeof recoveryCodes === 'string' ? codes : recoveryCodes,
      })
      expect(post).toHaveBeenCalledWith(
        '/auth/two-factor/verify',
        { challenge, code: '123456' },
        { credentials: 'include', skipAuthRefresh: true },
      )
      expect(get).toHaveBeenCalledOnce()
      expect(auth.authenticated.value).toBe(true)
      expect(auth.accessToken.value).toBe('verified-token')
      expect(loading.active.value).toBe(false)
    },
  )

  it('requires a new enrollment challenge after using a recovery code without accepting a session', async () => {
    const { auth, post, get } = setup()
    post.mockResolvedValue(
      response({ accessToken: null, challenge, setupSecret, recoveryCodes: '[]' }),
    )
    await expect(auth.verifyTwoFactor(challenge, codes[0]!)).resolves.toEqual({
      challenge,
      setupSecret,
    })
    expect(auth.authenticated.value).toBe(false)
    expect(auth.accessToken.value).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('does not refresh or retry invalid second-factor codes without an OpenAPI document', async () => {
    const refresh = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('{"code":"TWO_FACTOR_INVALID"}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const http = createHttpClient({ fetch, configuration: { refreshAccessToken: refresh } })
    const auth = createAuth({ http })
    await expect(auth.verifyTwoFactor(challenge, '000000')).rejects.toThrow()
    expect(fetch).toHaveBeenCalledOnce()
    expect(refresh).not.toHaveBeenCalled()
    expect(auth.authenticated.value).toBe(false)
  })

  it.each([
    { accessToken: null, recoveryCodes: [] },
    { accessToken: 'token', recoveryCodes: [codes[0]] },
    { accessToken: 'token', recoveryCodes: Array(10).fill(codes[0]) },
    { accessToken: 'token', recoveryCodes: '{}' },
    { accessToken: 'token', challenge, setupSecret, recoveryCodes: [] },
    { accessToken: null, challenge, setupSecret: null, recoveryCodes: [] },
  ])('rejects invalid verification responses without authenticating', async (body) => {
    const { auth, post } = setup()
    post.mockResolvedValue(response(body))
    await expect(auth.verifyTwoFactor(challenge, '123456')).rejects.toThrow()
    expect(auth.authenticated.value).toBe(false)
    expect(auth.accessToken.value).toBeNull()
    expect(loading.active.value).toBe(false)
  })

  it.each([401, 403, 429])(
    'surfaces verification errors (%s) and releases loading state',
    async (status) => {
      const { auth, post } = setup()
      const error = Object.assign(new Error('Verification failed'), {
        status,
        request: '/auth/two-factor/verify',
      })
      post.mockResolvedValue({ data: null, error, status, headers: null })
      await expect(auth.verifyTwoFactor(challenge, '123456')).rejects.toBe(error)
      expect(auth.authenticated.value).toBe(false)
      expect(loading.active.value).toBe(false)
    },
  )
})
