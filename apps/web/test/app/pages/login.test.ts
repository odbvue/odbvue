import { authState } from '../../auth-state'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAuth, type Auth } from '@/capabilities/auth'
import { createState } from '@/capabilities/state'
import { i18n } from '@/capabilities/i18n'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import Login from '@/app/pages/login.vue'
import messages from '@/app/i18n/en.json'
import { createAuthGuard } from '@/capabilities/routing/auth'

const session = vi.hoisted((): { auth?: Auth } => ({}))
vi.mock('@/capabilities/auth', async (importOriginal) => {
  const module = await importOriginal<typeof import('@/capabilities/auth')>()
  return { ...module, useAuth: () => session.auth }
})

const form = defineComponent({
  props: ['loading'],
  emits: ['submit'],
  template: `<button @click="$emit('submit', { username: 'ada', password: 'password' })" />`,
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function setup(location = '/login?redirect=/sandbox') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: {} },
      { path: '/login', component: {} },
      { path: '/sandbox', component: {} },
      { path: '/account', component: {}, meta: { access: 'authenticated', navigation: false } },
    ],
  })
  await router.push(location)
  const fetch = vi.fn<typeof globalThis.fetch>()
  fetch.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json(authState()))
  const auth: Auth = createAuth({
    http: () => useHttp({ fetch, configuration: { getAccessToken: () => auth.accessToken.value } }),
  })
  session.auth = auth
  await auth.restore()
  const ui = useUi()
  ui.clear()
  const wrapper = mount(Login, {
    global: {
      plugins: [createState(), i18n, router],
      stubs: {
        VOvGoogleSignIn: true,
        VOvForm: form,
        VContainer: { template: '<div><slot /></div>' },
        VRow: { template: '<div><slot /></div>' },
        VCol: { template: '<div><slot /></div>' },
      },
    },
  })
  return { wrapper, router, fetch, ui, auth }
}

describe('login page using application auth', () => {
  beforeEach(() => {
    vi.stubGlobal('definePage', vi.fn<() => void>())
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([
    ['cancelled', 'auth.google.cancelled'],
    ['failed', 'auth.google.failed'],
    ['conflict', 'auth.google.conflict'],
    ['untrusted backend detail', 'auth.google.failed'],
  ])('consumes Google callback %s once and preserves the destination', async (result, message) => {
    const context = await setup(
      `/login?redirect=/sandbox&google=${encodeURIComponent(result)}&other=kept`,
    )
    await flushPromises()
    expect(context.ui.notification.value?.message).toBe(message)
    expect(context.router.currentRoute.value.query).toEqual({
      redirect: '/sandbox',
      other: 'kept',
    })
    expect(context.fetch).toHaveBeenCalledTimes(2)
    context.wrapper.unmount()
  })

  it('leaves successful restoration and redirects to the auth guard', async () => {
    const context = await setup('/login?google=success&redirect=/sandbox')
    await flushPromises()
    expect(context.ui.notification.value).toBeUndefined()
    expect(context.router.currentRoute.value.query).toEqual({ redirect: '/sandbox' })
    expect(context.fetch).toHaveBeenCalledTimes(2)
    context.wrapper.unmount()
  })

  it('guides email conflicts to existing-account login then explicit connection without autolinking', async () => {
    const context = await setup('/login?google=conflict')
    await flushPromises()
    expect(messages['auth.google.conflict']).toContain('Connect Google')
    expect(messages['auth.google.conflict']).toContain('never linked automatically')
    expect(context.auth.authenticated.value).toBe(false)
    expect(context.fetch).toHaveBeenCalledTimes(2)
    expect(context.router.currentRoute.value.path).toBe('/login')
    context.wrapper.unmount()
  })

  it('takes an authenticated collision through Connect Google before the original destination', async () => {
    const redirect = '/account?redirect=%2Fsandbox'
    const context = await setup(`/login?google=conflict&redirect=${encodeURIComponent(redirect)}`)
    await flushPromises()
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'login-token' }))
      .mockResolvedValueOnce(json(authState({ userId: 7, username: 'ada' })))
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.router.currentRoute.value.path).toBe('/account')
    expect(context.router.currentRoute.value.query.redirect).toBe('/sandbox')
    expect(context.fetch).toHaveBeenCalledTimes(4)
    context.router.beforeEach(createAuthGuard(context.router, context.auth))
    await context.router.push(`/login?google=conflict&redirect=${encodeURIComponent(redirect)}`)
    expect(context.router.currentRoute.value.path).toBe('/account')
    expect(context.router.currentRoute.value.query.redirect).toBe('/sandbox')
    context.wrapper.unmount()
  })

  it('logs in, redirects, and keeps credentials out of storage', async () => {
    const context = await setup()
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'login-token' }))
      .mockResolvedValueOnce(
        json(authState({ userId: 7, username: 'ada', permissions: ['settings.read'] })),
      )

    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.auth.authenticated.value).toBe(true)
    expect(context.auth.can('settings.read')).toBe(true)
    expect(context.router.currentRoute.value.path).toBe('/sandbox')
    expect(context.ui.loading.value).toBe(false)
    const [, options] = context.fetch.mock.calls[2]!
    expect(options?.credentials).toBe('include')
    expect(JSON.parse(String(options?.body))).toEqual({ username: 'ada', password: 'password' })
    expect(JSON.stringify(localStorage)).not.toMatch(/login-token|password|ada/)
    expect(sessionStorage.length).toBe(0)
    context.wrapper.unmount()
  })

  it.each([
    [401, 'auth.invalid.credentials'],
    [403, 'auth.forbidden'],
    [429, 'auth.too.many.requests'],
  ])('preserves login feedback for HTTP %s', async (status, message) => {
    const context = await setup()
    context.fetch.mockResolvedValueOnce(json({}, status))
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()

    expect(context.ui.notification.value?.message).toBe(message)
    expect(context.auth.authenticated.value).toBe(false)
    expect(context.auth.loading.value).toBe(false)
    expect(context.ui.loading.value).toBe(false)
    expect(context.router.currentRoute.value.path).toBe('/login')
    context.wrapper.unmount()
  })

  it('reports offline login errors and releases loading state', async () => {
    const context = await setup()
    context.fetch.mockRejectedValueOnce(new Error('Offline'))
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.ui.notification.value?.message).toContain('Offline')
    expect(context.auth.loading.value).toBe(false)
    expect(context.ui.loading.value).toBe(false)
    context.wrapper.unmount()
  })

  it('uses main-content loading instead of form loading and prevents duplicate submissions', async () => {
    const context = await setup()
    let finish!: (response: Response) => void
    context.fetch
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce(json(authState({ userId: 7, username: 'ada' })))
    const loginForm = context.wrapper.findComponent(form)
    expect(loginForm.props('loading')).toBeUndefined()
    expect(context.ui.loading.value).toBe(false)
    await loginForm.trigger('click')
    expect(loginForm.props('loading')).toBeUndefined()
    expect(context.auth.loading.value).toBe(true)
    expect(context.ui.loading.value).toBe(true)
    await loginForm.trigger('click')
    expect(context.fetch).toHaveBeenCalledTimes(3)
    finish(json({ accessToken: 'login-token' }))
    await flushPromises()
    expect(loginForm.props('loading')).toBeUndefined()
    expect(context.ui.loading.value).toBe(false)
    expect(context.auth.authenticated.value).toBe(true)
    context.wrapper.unmount()
  })

  it('clears an issued token when fetching the identity fails', async () => {
    const context = await setup()
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'login-token' }))
      .mockResolvedValue(json({}, 403))
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.auth.accessToken.value).toBeNull()
    expect(context.auth.user.value).toBeNull()
    expect(context.ui.notification.value?.type).toBe('error')
    expect(context.ui.loading.value).toBe(false)
    context.wrapper.unmount()
  })
})
