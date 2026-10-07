import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { authCapability, authContract, defineOdbVueApp, installOdbVue, useHttp } from '@odbvue/web'
import { useAppStore } from '../stores'
import { useAuthStore } from '../stores/auth'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup() {
  vi.spyOn(authCapability, 'start').mockResolvedValue(undefined)
  const app = createApp({})
  const runtime = installOdbVue(
    app,
    defineOdbVueApp({ title: 'OdbVue', version: '1.0.0', errors: { reporters: [] } }),
  )
  const capability = runtime.get(authContract)
  const fetch = vi.fn<typeof globalThis.fetch>()
  capability.setHttp(
    useHttp({ fetch, configuration: { getAccessToken: () => capability.accessToken.value } }),
  )
  const main = app.runWithContext(() => useAppStore())
  const auth = app.runWithContext(() => useAuthStore())
  return { main, auth, capability, fetch }
}

async function anonymous(context: ReturnType<typeof setup>) {
  context.fetch.mockResolvedValueOnce(json({}, 401))
  await context.capability.restore()
  await context.auth.init()
}

describe('application auth stores', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('waits for runtime restoration without refreshing twice', async () => {
    const { auth, main, capability, fetch } = setup()
    let settled = false
    const first = auth.init()
    const second = auth.init()
    const initialized = main.init().then(() => {
      settled = true
    })
    await nextTick()
    expect(settled).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    fetch
      .mockResolvedValueOnce(json({ accessToken: 'restored-token' }))
      .mockResolvedValueOnce(
        json({ userId: 7, username: 'ada', displayName: 'Ada', roles: ['developer'] }),
      )

    await capability.restore()
    await Promise.all([first, second])
    await initialized

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(auth.ready).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(main.auth).toBe(auth)
    expect(main.user).toMatchObject({ username: 'ada', displayName: 'Ada' })
    expect(auth.hasRole('developer')).toBe(true)
    expect(main.title).toBe('OdbVue')
    expect(main.version).toBe('1.0.0')
  })

  it('logs in through the shared capability and keeps auth data out of storage', async () => {
    const context = setup()
    await anonymous(context)
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'login-token' }))
      .mockResolvedValueOnce(json({ userId: 7, username: 'ada', permissions: ['settings.read'] }))

    await expect(context.auth.login('ada', 'password')).resolves.toBe(true)

    expect(context.capability.authenticated.value).toBe(true)
    expect(context.main.user?.username).toBe('ada')
    expect(context.auth.can('settings.read')).toBe(true)
    const [, options] = context.fetch.mock.calls[1]!
    expect(options?.credentials).toBe('include')
    expect(JSON.parse(String(options?.body))).toEqual({ username: 'ada', password: 'password' })
    expect(JSON.stringify(localStorage)).not.toMatch(/login-token|password|ada/)
    expect(sessionStorage.length).toBe(0)

    context.fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(context.auth.logout()).resolves.toBe(true)
    expect(context.main.user).toBeNull()
    expect(context.auth.accessToken).toBeNull()
    expect(context.capability.authenticated.value).toBe(false)
  })

  it.each([
    [401, 'auth.invalid.credentials'],
    [403, 'auth.forbidden'],
    [429, 'auth.too.many.requests'],
  ])('shows feedback for failed login (%s)', async (status, message) => {
    const context = setup()
    await anonymous(context)
    context.fetch.mockResolvedValueOnce(json({}, status))

    await expect(context.auth.login('ada', 'wrong')).resolves.toBe(false)

    expect(context.main.ui.notification?.message).toBe(message)
    expect(context.auth.isAuthenticated).toBe(false)
    expect(context.auth.loading).toBe(false)
  })

  it('reports an offline login and releases loading state', async () => {
    const context = setup()
    await anonymous(context)
    context.fetch.mockRejectedValueOnce(new Error('Offline'))

    await expect(context.auth.login('ada', 'password')).resolves.toBe(false)
    expect(context.main.ui.notification?.message).toContain('Offline')
    expect(context.auth.loading).toBe(false)
  })

  it('reports logout failure while clearing the local identity', async () => {
    const context = setup()
    await anonymous(context)
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'login-token' }))
      .mockResolvedValueOnce(json({ userId: 7, username: 'ada' }))
    await context.auth.login('ada', 'password')
    context.fetch.mockResolvedValueOnce(json({}, 500))

    await expect(context.auth.logout()).resolves.toBe(false)
    expect(context.main.ui.notification?.type).toBe('error')
    expect(context.main.user).toBeNull()
    expect(context.auth.accessToken).toBeNull()
  })

  it('does not keep an issued token when loading the identity fails', async () => {
    const context = setup()
    await anonymous(context)
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'login-token' }))
      .mockResolvedValue(json({}, 403))

    await expect(context.auth.login('ada', 'password')).resolves.toBe(false)
    expect(context.auth.accessToken).toBeNull()
    expect(context.main.user).toBeNull()
    expect(context.main.ui.notification?.type).toBe('error')
  })
})
