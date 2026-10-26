import { afterEach, describe, expect, it, vi } from 'vitest'
import { isReadonly } from 'vue'
import { createAuth as createCoreAuth, type AuthOptions } from '@/capabilities/auth/core.js'
import { createHttpClient } from '@/capabilities/http/core.js'
import { createLoading } from '@/capabilities/ui/loading'
import { authConfig } from '../auth-state'

const loading = createLoading()
const ada = { userId: 7, username: 'ada' }
const credentials = { username: 'ada', password: 'password' }
const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=server-state'

function response<T>(data: T | null, status = 200) {
  return { data, error: null, status, headers: null }
}

function setup(options: Partial<AuthOptions> = {}) {
  const http = createHttpClient()
  const post = vi.spyOn(http, 'post').mockResolvedValue(response({ accessToken: 'token' }))
  const put = vi.spyOn(http, 'put').mockResolvedValue(response(null, 204))
  const get = vi
    .spyOn(http, 'get')
    .mockImplementation(async (url) => response(url.endsWith('/config') ? authConfig() : ada))
  const auth = createCoreAuth({
    http,
    onOperation: (operation) => loading.start(operation),
    ...options,
  })
  return { auth, http, post, put, get }
}

async function session() {
  const context = setup()
  await context.auth.restore()
  context.post.mockClear()
  return context
}

describe('authentication capability', () => {
  afterEach(() => vi.restoreAllMocks())

  it('exposes one readonly config and namespaced feature surface without old aliases', () => {
    const { auth } = setup()
    expect(isReadonly(auth.config)).toBe(true)
    expect(isReadonly(auth.user)).toBe(true)
    expect(auth.config.value).toBeNull()
    for (const old of [
      'providers',
      'signupEnabled',
      'twoFactorEnabled',
      'getState',
      'startGoogleLogin',
      'startGoogleLink',
      'verifyTwoFactor',
      'confirmEmail',
      'recoverPassword',
      'resetPassword',
      'changePassword',
      'updateAvatar',
    ])
      expect(auth).not.toHaveProperty(old)
    expect(auth.password.change).toBeTypeOf('function')
    expect(auth.google.link).toBeTypeOf('function')
    expect(auth.twoFactor.verify).toBeTypeOf('function')
    expect(auth.profile.updateAvatar).toBeTypeOf('function')
  })

  it.each([true, false])(
    'loads deployment configuration without an authenticated profile (%s)',
    async (google) => {
      const { auth, get, post } = setup()
      get.mockResolvedValue(response(authConfig(google)))
      post.mockResolvedValue(response(null, 401))
      await expect(auth.restore()).resolves.toBe(false)
      expect(auth.config.value).toEqual(authConfig(google))
      expect(auth.ready.value).toBe(true)
      expect(get).toHaveBeenCalledExactlyOnceWith('/auth/config', {
        credentials: 'omit',
        skipAuthRefresh: true,
      })
      expect(auth.user.value).toBeNull()
      expect(auth.accessToken.value).toBeNull()
      expect(loading.active.value).toBe(false)
    },
  )

  it('loads config independently while refresh is pending and deduplicates restoration', async () => {
    const { auth, get, post } = setup()
    const refresh = Promise.withResolvers<ReturnType<typeof response>>()
    post.mockReturnValue(refresh.promise)
    const first = auth.restore()
    const second = auth.restore()
    expect(second).toBe(first)
    await vi.waitFor(() => expect(auth.config.value).toEqual(authConfig()))
    expect(get).toHaveBeenCalledTimes(1)
    expect(auth.ready.value).toBe(false)
    refresh.resolve(response({ accessToken: 'restored' }))
    await expect(first).resolves.toBe(true)
    expect(get).toHaveBeenLastCalledWith('/auth/me', {
      headers: { Authorization: ['Bearer', 'restored'].join(' ') },
    })
    expect(post).toHaveBeenCalledTimes(1)
    await auth.restore()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('shares restoration failures without retrying and retains loaded deployment config', async () => {
    const { auth, get, post } = setup()
    const failure = Object.assign(new Error('Profile unavailable'), {
      status: 503,
      request: '/auth/me',
    })
    get.mockImplementation(async (url) =>
      url.endsWith('/config') ? response(authConfig()) : { ...response(null, 503), error: failure },
    )
    const first = auth.restore()
    expect(auth.restore()).toBe(first)
    await expect(first).rejects.toBe(failure)
    await expect(auth.restore()).rejects.toBe(failure)
    expect(post).toHaveBeenCalledTimes(1)
    expect(auth.ready.value).toBe(true)
    expect(auth.accessToken.value).toBeNull()
    expect(auth.config.value).toEqual(authConfig())
    expect(loading.active.value).toBe(false)
  })

  it('keeps config after logout, password reset and failed profile hydration', async () => {
    const { auth, get, post } = await session()
    const configuration = auth.config.value
    await auth.logout()
    expect(auth.config.value).toBe(configuration)
    post.mockResolvedValue(response({ accessToken: 'next-token' }))
    await auth.login(credentials)
    await auth.password.reset({ token: 'reset', password: 'next', passwordRepeat: 'next' })
    expect(auth.config.value).toBe(configuration)
    get.mockResolvedValue(response(null))
    await expect(auth.login(credentials)).rejects.toThrow('user response')
    expect(auth.accessToken.value).toBeNull()
    expect(auth.config.value).toBe(configuration)
  })

  it.each([
    null,
    { password: true, google: true, signup: true, twoFactor: true },
    { ...authConfig(), password: 'true' },
    { ...authConfig(), twoFactor: 'false' },
  ])(
    'rejects malformed configuration instead of silently disabling features',
    async (configuration) => {
      const { auth, get, post } = setup()
      get.mockResolvedValue(response(configuration))
      post.mockResolvedValue(response(null, 401))
      await expect(auth.restore()).rejects.toThrow('configuration')
      expect(auth.config.value).toBeNull()
      expect(auth.ready.value).toBe(true)
    },
  )

  it('does not couple a restored identity to configuration failure', async () => {
    const { auth, get } = setup()
    const error = Object.assign(new Error('Config unavailable'), {
      status: 503,
      request: '/auth/config',
    })
    get.mockImplementation(async (url) =>
      url.endsWith('/config') ? { ...response(null, 503), error } : response(ada),
    )
    await expect(auth.restore()).rejects.toBe(error)
    await vi.waitFor(() => expect(auth.authenticated.value).toBe(true))
    expect(auth.config.value).toBeNull()
    expect(loading.active.value).toBe(false)
  })

  it('maps direct profile identity and ORDS authorization fields', async () => {
    const { auth, get } = setup()
    get.mockResolvedValue(
      response({
        ...ada,
        displayName: 'Ada',
        roles: '["admin"]',
        permissions: '["write"]',
        passwordConnected: 1,
        googleConnected: 0,
      }),
    )
    await auth.login(credentials)
    expect(auth.user.value).toMatchObject({
      id: 7,
      displayName: 'Ada',
      roles: ['admin'],
      permissions: ['write'],
      passwordConnected: true,
      googleConnected: false,
    })
    expect(auth.hasRole('admin')).toBe(true)
    expect(auth.hasRole('other')).toBe(false)
    expect(auth.can('write')).toBe(true)
    expect(auth.config.value).toBeNull()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it.each([
    { roles: ['admin'], permissions: ['write'] },
    { roles: '["admin"]', permissions: '["write"]' },
    { roles: '{invalid', permissions: '[1]' },
  ])(
    'normalizes profile authorization without inventing provider connections',
    async (authorization) => {
      const { auth, get } = setup()
      get.mockResolvedValue(response({ ...ada, ...authorization }))
      await auth.login(credentials)
      const valid = authorization.roles !== '{invalid'
      expect(auth.hasRole('admin')).toBe(valid)
      expect(auth.can('write')).toBe(valid)
      expect(auth.user.value?.passwordConnected).toBeUndefined()
      expect(auth.user.value?.googleConnected).toBeUndefined()
    },
  )

  it.each([null, {}, { user: ada }, { userId: 7, username: null }])(
    'clears issued tokens on malformed direct user responses',
    async (profile) => {
      const { auth, get } = setup()
      get.mockResolvedValue(response(profile))
      await expect(auth.login(credentials)).rejects.toThrow('user response')
      expect(auth.user.value).toBeNull()
      expect(auth.accessToken.value).toBeNull()
      expect(loading.active.value).toBe(false)
    },
  )

  it('supports independent custom config and profile endpoints', async () => {
    const { auth, get } = setup({ endpoints: { config: '/custom/config', me: '/custom/me' } })
    await auth.restore()
    expect(get.mock.calls.map(([url]) => url)).toEqual(['/custom/config', '/custom/me'])
  })

  it('keeps login active through nested profile work and overlapping refresh', async () => {
    const { auth, post, get } = setup()
    const profile = Promise.withResolvers<ReturnType<typeof response>>()
    const refresh = Promise.withResolvers<ReturnType<typeof response>>()
    post
      .mockResolvedValueOnce(response({ accessToken: 'login-token' }))
      .mockReturnValueOnce(refresh.promise)
    get.mockReturnValue(profile.promise)
    const login = auth.login(credentials)
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())
    expect(loading.has('auth.login')).toBe(true)
    expect(loading.has('auth.profile')).toBe(true)
    const refreshing = auth.refresh()
    refresh.resolve(response({ accessToken: 'fresh-token' }))
    await refreshing
    expect(loading.has('auth.refresh')).toBe(false)
    expect(loading.has('auth.login')).toBe(true)
    profile.resolve(response(ada))
    await login
    expect(loading.active.value).toBe(false)
    expect(auth.authenticated.value).toBe(true)
    expect(auth).not.toHaveProperty('loading')
  })

  it('updates and removes the avatar with PUT then reloads only the profile', async () => {
    const { auth, put, get } = await session()
    get.mockClear()
    for (const avatar of ['data:image/jpeg;base64,/9j/AA==', null]) {
      await auth.profile.updateAvatar(avatar)
      expect(put).toHaveBeenLastCalledWith(
        '/auth/me/avatar',
        { avatar },
        {
          credentials: 'include',
          skipAuthRefresh: true,
          headers: { Authorization: ['Bearer', 'token'].join(' ') },
        },
      )
    }
    expect(get.mock.calls.map(([url]) => url)).toEqual(['/auth/me', '/auth/me'])
  })

  it('allows Google linking during profile reload without presentation tracking', async () => {
    const http = createHttpClient()
    const post = vi.spyOn(http, 'post').mockResolvedValue(response({ accessToken: 'token' }))
    vi.spyOn(http, 'put').mockResolvedValue(response(null, 204))
    const get = vi
      .spyOn(http, 'get')
      .mockImplementation(async (url) => response(url.endsWith('/config') ? authConfig() : ada))
    const auth = createCoreAuth({ http })
    await auth.restore()
    const profile = Promise.withResolvers<ReturnType<typeof response>>()
    get.mockReturnValueOnce(profile.promise)
    const avatar = auth.profile.updateAvatar(null)
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(3))
    post.mockResolvedValueOnce(response({ authorizationUrl }))
    await expect(auth.google.link({ password: 'password' })).resolves.toEqual({ authorizationUrl })
    profile.resolve(response(ada))
    await avatar
  })

  it('maps uploaded avatars and revokes replaced URLs and signed-out avatars', async () => {
    const { auth, get } = setup()
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' })
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    get
      .mockResolvedValueOnce(response({ ...ada, avatarUploaded: 1, avatarId: 'a'.repeat(32) }))
      .mockResolvedValueOnce(response(blob))
    await auth.login(credentials)
    expect(auth.user.value?.avatarUrl).toBe('blob:avatar')
    expect(createUrl).toHaveBeenCalledWith(blob)
    expect(get).toHaveBeenLastCalledWith(`/auth/avatar/${'a'.repeat(32)}`, {
      responseType: 'blob',
      headers: { Authorization: ['Bearer', 'token'].join(' ') },
    })
    get.mockResolvedValue(response({ ...ada, avatarUrl: 'https://example.test/avatar' }))
    await auth.refreshUser()
    expect(auth.user.value?.avatarUrl).toBe('https://example.test/avatar')
    expect(revoke).toHaveBeenCalledWith('blob:avatar')
    get
      .mockResolvedValueOnce(response({ ...ada, avatarUploaded: 1, avatarId: 'a'.repeat(32) }))
      .mockResolvedValueOnce(response(blob))
    await auth.refreshUser()
    revoke.mockClear()
    await auth.logout()
    expect(revoke).toHaveBeenCalledWith('blob:avatar')
  })

  it('does not resurrect a profile from an avatar download after logout', async () => {
    const { auth, get } = await session()
    const download = Promise.withResolvers<ReturnType<typeof response>>()
    get
      .mockResolvedValueOnce(response({ ...ada, avatarUploaded: 1, avatarId: 'd'.repeat(32) }))
      .mockReturnValueOnce(download.promise)
    const profile = auth.refreshUser()
    await vi.waitFor(() =>
      expect(get).toHaveBeenLastCalledWith(`/auth/avatar/${'d'.repeat(32)}`, expect.anything()),
    )
    await auth.logout()
    download.resolve(response(new Blob(['jpeg'], { type: 'image/jpeg' })))
    await expect(profile).rejects.toThrow('no longer current')
    expect(auth.user.value).toBeNull()
  })

  it('keeps the latest profile when profile requests complete out of order', async () => {
    const { auth, get } = await session()
    const stale = Promise.withResolvers<ReturnType<typeof response>>()
    get
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(response({ ...ada, displayName: 'Latest' }))
    const previous = auth.refreshUser()
    await auth.refreshUser()
    stale.resolve(response({ ...ada, displayName: 'Stale' }))
    await expect(previous).rejects.toThrow('no longer current')
    expect(auth.user.value?.displayName).toBe('Latest')
    expect(loading.active.value).toBe(false)
  })

  it.each([
    { avatarUploaded: 1, avatarId: '../invalid' },
    { avatarUploaded: 1, avatarId: null },
  ])('rejects unsafe avatar keys without replacing the profile', async (avatar) => {
    const { auth, get } = await session()
    const previous = auth.user.value
    get.mockResolvedValue(response({ ...ada, ...avatar }))
    await expect(auth.refreshUser()).rejects.toThrow('storage key')
    expect(auth.user.value).toBe(previous)
  })

  it('surfaces failed avatar downloads without replacing the profile', async () => {
    const { auth, get } = await session()
    const previous = auth.user.value
    get
      .mockResolvedValueOnce(response({ ...ada, avatarUploaded: 1, avatarId: 'c'.repeat(32) }))
      .mockResolvedValueOnce(response(new Blob(['png'], { type: 'image/png' })))
    await expect(auth.refreshUser()).rejects.toThrow('retrieve the profile avatar')
    expect(auth.user.value).toBe(previous)
  })

  it('changes passwords only with authenticated identity and clears session after success', async () => {
    const { auth, post } = await session()
    const change = { currentPassword: 'old', password: 'new', passwordRepeat: 'new' }
    const error = Object.assign(new Error('Incorrect password'), {
      status: 403,
      request: '/auth/password/change',
    })
    post.mockResolvedValue({ ...response(null, 403), error })
    await expect(auth.password.change(change)).rejects.toBe(error)
    expect(auth.authenticated.value).toBe(true)
    post.mockResolvedValue(response(null, 204))
    await auth.password.change(change)
    expect(post).toHaveBeenLastCalledWith('/auth/password/change', change, {
      credentials: 'include',
      skipAuthRefresh: true,
      headers: { Authorization: ['Bearer', 'token'].join(' ') },
    })
    expect(auth.authenticated.value).toBe(false)
  })

  it('uses anonymous signup, confirmation and password recovery/reset routes', async () => {
    const { auth, post } = setup()
    post.mockResolvedValue(response(null, 204))
    const signup = {
      email: 'ada@example.com',
      fullName: 'Ada',
      password: 'pw',
      passwordRepeat: 'pw',
    }
    const reset = { token: 'token', password: 'pw', passwordRepeat: 'pw' }
    await auth.signup(signup)
    await auth.confirmSignup('confirmation')
    await auth.password.recover(signup.email)
    await auth.password.reset(reset)
    expect(post.mock.calls).toEqual([
      ['/auth/signup', signup, { credentials: 'omit' }],
      ['/auth/signup/confirm', { token: 'confirmation' }, { credentials: 'omit' }],
      ['/auth/password/recover', { email: signup.email }, { credentials: 'omit' }],
      ['/auth/password/reset', reset, { credentials: 'omit' }],
    ])
    expect(loading.active.value).toBe(false)
  })

  it('observes overlapping requests without locking unrelated authenticated operations', async () => {
    const { auth, post } = await session()
    const first = Promise.withResolvers<ReturnType<typeof response>>()
    const second = Promise.withResolvers<ReturnType<typeof response>>()
    post.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const signup = auth.confirmSignup('token')
    const recover = auth.password.recover('ada@example.com')
    first.resolve(response(null, 204))
    await signup
    expect(loading.has('auth.recoverPassword')).toBe(true)
    await auth.profile.updateAvatar(null)
    post.mockResolvedValueOnce(response({ authorizationUrl }))
    await expect(auth.google.link({ password: 'pw' })).resolves.toEqual({ authorizationUrl })
    expect(loading.has('auth.recoverPassword')).toBe(true)
    expect(loading.has('auth.avatar')).toBe(false)
    expect(loading.has('auth.googleLink')).toBe(false)
    second.resolve(response(null, 204))
    await recover
    expect(loading.active.value).toBe(false)
  })

  it('rejects profile mutation and linking before a ready session', async () => {
    const { auth, post, put } = setup()
    await expect(auth.profile.updateAvatar(null)).rejects.toThrow('Sign in')
    await expect(
      auth.password.change({ currentPassword: 'old', password: 'new', passwordRepeat: 'new' }),
    ).rejects.toThrow('Sign in')
    await expect(auth.google.link({ password: 'pw' })).rejects.toThrow('Sign in')
    expect(post).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('starts Google login anonymously with transaction cookies', async () => {
    const { auth, post } = setup()
    post.mockResolvedValue(response({ authorizationUrl }))
    await expect(auth.google.login({ redirect: '/sandbox' })).resolves.toEqual({ authorizationUrl })
    expect(post).toHaveBeenLastCalledWith(
      '/auth/google/start',
      { redirect: '/sandbox' },
      { credentials: 'include' },
    )
    expect(auth.accessToken.value).toBeNull()
  })

  it.each([undefined, '/sandbox?tab=profile#section'])(
    'links Google with the current identity (%s)',
    async (redirect) => {
      const { auth, post } = await session()
      const previous = auth.user.value
      post.mockResolvedValue(response({ authorizationUrl, accessToken: 'ignored' }))
      await expect(auth.google.link({ redirect, password: 'pw' })).resolves.toMatchObject({
        authorizationUrl,
      })
      expect(post).toHaveBeenLastCalledWith(
        '/auth/google/link/start',
        {
          redirect: redirect ?? '/settings/account',
          password: 'pw',
        },
        {
          credentials: 'include',
          skipAuthRefresh: true,
          headers: { Authorization: ['Bearer', 'token'].join(' ') },
        },
      )
      expect(auth.user.value).toBe(previous)
      expect(auth.accessToken.value).toBe('token')
    },
  )

  it.each([
    'https://evil.example/o/oauth2/v2/auth',
    'http://accounts.google.com/o/oauth2/v2/auth',
    'https://accounts.google.com:444/o/oauth2/v2/auth',
    'https://accounts.google.com/other',
    'https://accounts.google.com.evil.example/o/oauth2/v2/auth',
    'https://user@accounts.google.com/o/oauth2/v2/auth',
    '/o/oauth2/v2/auth',
    'javascript:alert(1)',
    '',
    undefined,
  ])('rejects unsafe Google URLs without switching the session (%s)', async (url) => {
    const { auth, post } = await session()
    post.mockResolvedValue(response({ authorizationUrl: url }))
    await expect(auth.google.login()).rejects.toThrow()
    await expect(auth.google.link({ password: 'pw' })).rejects.toThrow()
    expect(auth.accessToken.value).toBe('token')
    expect(loading.active.value).toBe(false)
  })

  it('rejects empty linking passwords and overlapping link starts', async () => {
    const { auth, post } = await session()
    await expect(auth.google.link({ password: '' })).rejects.toThrow('password')
    expect(post).not.toHaveBeenCalled()
    const request = Promise.withResolvers<ReturnType<typeof response>>()
    post.mockReturnValueOnce(request.promise)
    const first = auth.google.link({ password: 'pw' })
    await expect(auth.google.link({ password: 'pw' })).rejects.toThrow('in progress')
    request.reject(new Error('Offline'))
    await expect(first).rejects.toThrow('Offline')
    expect(auth.authenticated.value).toBe(true)
    expect(loading.active.value).toBe(false)
    post.mockResolvedValueOnce(response({ authorizationUrl }))
    await expect(auth.google.link({ password: 'pw' })).resolves.toEqual({ authorizationUrl })
  })

  it('does not refresh or switch sessions after Google link password rejection', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const path = String(input)
      const data = path.endsWith('/auth/config')
        ? authConfig()
        : path.endsWith('/auth/refresh')
          ? { accessToken: 'token' }
          : ada
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const refresh = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
    const auth = createCoreAuth({
      http: createHttpClient({ fetch, configuration: { refreshAccessToken: refresh } }),
    })
    await auth.restore()
    fetch.mockClear()
    fetch.mockResolvedValueOnce(
      new Response('{}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(auth.google.link({ password: 'wrong' })).rejects.toMatchObject({ status: 401 })
    expect(refresh).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(auth.accessToken.value).toBe('token')
    expect(auth.authenticated.value).toBe(true)
  })

  it.each([401, 403, 409, 429, 500])('preserves the session after link HTTP %s', async (status) => {
    const { auth, post } = await session()
    post.mockResolvedValue({
      ...response(null, status),
      error: Object.assign(new Error('Link rejected'), {
        status,
        request: '/auth/google/link/start',
      }),
    })
    await expect(auth.google.link({ password: 'pw' })).rejects.toThrow('Link rejected')
    expect(auth.accessToken.value).toBe('token')
    expect(loading.active.value).toBe(false)
  })

  it.each([200, 401, 503])(
    'shares concurrent refresh requests and permits a later refresh after HTTP %s',
    async (status) => {
      const { auth, post } = await session()
      const request = Promise.withResolvers<ReturnType<typeof response>>()
      post.mockReturnValueOnce(request.promise)
      const first = auth.refresh()
      expect(auth.refresh()).toBe(first)
      expect(post).toHaveBeenCalledExactlyOnceWith('/auth/refresh', undefined, {
        credentials: 'include',
      })
      expect(loading.has('auth.refresh')).toBe(true)
      await auth.profile.updateAvatar(null)
      expect(loading.has('auth.refresh')).toBe(true)
      request.resolve(response(status === 200 ? { accessToken: 'next-token' } : null, status))
      await expect(first).resolves.toBe(status === 200)
      expect(loading.active.value).toBe(false)
      post.mockResolvedValueOnce(response({ accessToken: 'later-token' }))
      await expect(auth.refresh()).resolves.toBe(true)
      expect(post).toHaveBeenCalledTimes(2)
      expect(auth.accessToken.value).toBe('later-token')
    },
  )

  it('releases refresh deduplication and loading observation after a rejected request', async () => {
    const { auth, post } = await session()
    const request = Promise.withResolvers<ReturnType<typeof response>>()
    post.mockReturnValueOnce(request.promise)
    const first = auth.refresh()
    expect(auth.refresh()).toBe(first)
    request.reject(new Error('Offline'))
    await expect(first).rejects.toThrow('Offline')
    expect(loading.active.value).toBe(false)
    post.mockResolvedValueOnce(response({ accessToken: 'later-token' }))
    await expect(auth.refresh()).resolves.toBe(true)
    expect(post).toHaveBeenCalledTimes(2)
  })

  it.each([401, 403])('clears identity on invalid refresh cookie (%s)', async (status) => {
    const { auth, post } = await session()
    post.mockResolvedValue(response(null, status))
    await expect(auth.refresh()).resolves.toBe(false)
    expect(auth.accessToken.value).toBeNull()
    expect(auth.user.value).toBeNull()
    expect(auth.config.value).toEqual(authConfig())
  })

  it('preserves identity on an unavailable refresh and clears it even when logout fails', async () => {
    const { auth, post } = await session()
    const error = Object.assign(new Error('Offline'), { status: 503, request: '/auth/refresh' })
    post.mockResolvedValue({ ...response(null, 503), error })
    await expect(auth.refresh()).resolves.toBe(false)
    expect(auth.authenticated.value).toBe(true)
    await expect(auth.logout()).rejects.toBe(error)
    expect(auth.authenticated.value).toBe(false)
    expect(auth.config.value).toEqual(authConfig())
    expect(loading.active.value).toBe(false)
  })

  it('preserves the session when refresh fails without an HTTP response', async () => {
    const { auth, post } = await session()
    const previous = auth.user.value
    post.mockResolvedValue({
      data: null,
      status: null,
      headers: null,
      error: Object.assign(new Error('Offline'), { status: null, request: '/auth/refresh' }),
    })
    await expect(auth.refresh()).resolves.toBe(false)
    expect(auth.user.value).toBe(previous)
    expect(auth.accessToken.value).toBe('token')
  })
})
