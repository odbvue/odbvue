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
import { appConfig } from '@/capabilities/config'
import QRCode from 'qrcode'

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
      {
        path: '/settings/account',
        component: {},
        meta: { access: 'authenticated', navigation: false },
      },
    ],
  })
  await router.push(location)
  const fetch = vi.fn<typeof globalThis.fetch>()
  fetch.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json(authState()))
  const auth: Auth = createAuth({
    onOperation: (operation) => useUi().loading.start(operation),
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
        VBtn: { template: '<button type="button"><slot /></button>' },
        VAlert: { template: '<div><slot /></div>' },
        VTextField: {
          props: ['modelValue', 'readonly'],
          emits: ['update:modelValue'],
          template:
            '<input :value="modelValue" :readonly="readonly" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
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

  it('shows the ordinary credential form for LDAP-only deployments without local recovery', async () => {
    const context = await setup()
    context.fetch.mockResolvedValueOnce(
      json({
        ...authState(),
        providers: { password: false, google: false, ldap: true },
        signup: false,
      }),
    )
    await context.auth.getState()
    await flushPromises()
    expect(context.wrapper.findComponent(form).exists()).toBe(true)
    expect(context.wrapper.text()).not.toContain(messages['auth.recover.title'])
    context.fetch.mockResolvedValueOnce(
      json({
        accessToken: null,
        challenge: 'A'.repeat(64),
        setupSecret: null,
      }),
    )
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.fetch.mock.calls.at(-1)?.[0]).toContain('/auth/login')
    expect(context.wrapper.find('form').exists()).toBe(true)
    context.wrapper.unmount()
  })

  it('enrolls an authenticator, displays recovery codes once, then preserves the original redirect', async () => {
    const encode = vi.spyOn(QRCode, 'toString')
    const context = await setup()
    const challenge = 'A'.repeat(64)
    const secret = 'A'.repeat(32)
    const codes = Array.from({ length: 10 }, (_, index) => String(index).padStart(32, '0'))
    context.fetch.mockResolvedValueOnce(json({ accessToken: null, challenge, setupSecret: secret }))
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.auth.authenticated.value).toBe(false)
    expect(context.router.currentRoute.value.path).toBe('/login')
    expect(context.wrapper.find('input[readonly]').element).toHaveProperty('value', secret)
    expect(encode).toHaveBeenCalledOnce()
    const [uri, options] = encode.mock.calls[0]!
    const payload = new URL(String(uri))
    expect(payload.protocol).toBe('otpauth:')
    expect(payload.hostname).toBe('totp')
    expect(decodeURIComponent(payload.pathname.slice(1))).toBe(`${appConfig.title ?? 'OdbVue'}:ada`)
    expect(Object.fromEntries(payload.searchParams)).toEqual({
      secret,
      issuer: appConfig.title ?? 'OdbVue',
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    })
    expect(options).toMatchObject({ type: 'svg', width: 256, margin: 4, errorCorrectionLevel: 'M' })
    const image = context.wrapper.find('img')
    expect(image.attributes('src')).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    const svg = decodeURIComponent(image.attributes('src')!.split(',')[1]!)
    expect(svg).toContain('<svg')
    expect(svg).toContain('<path')
    expect(context.wrapper.find('details').attributes('open')).toBeUndefined()
    expect(context.fetch).toHaveBeenCalledTimes(3)
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'verified-token', recoveryCodes: codes }))
      .mockResolvedValueOnce(json(authState({ userId: 7, username: 'ada' })))
    await context.wrapper.find('input[autocomplete="one-time-code"]').setValue('123456')
    await context.wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(context.auth.authenticated.value).toBe(true)
    expect(context.wrapper.findAll('li code')).toHaveLength(10)
    expect(context.router.currentRoute.value.path).toBe('/login')
    expect(context.wrapper.find('input[readonly]').exists()).toBe(false)
    expect(context.wrapper.find('img').exists()).toBe(false)
    expect(JSON.stringify(localStorage)).not.toMatch(/verified-token|123456|AAAAAAAA/)
    expect(sessionStorage.length).toBe(0)
    const acknowledge = context.wrapper.find('button')
    await acknowledge.trigger('click')
    await flushPromises()
    expect(context.router.currentRoute.value.path).toBe('/sandbox')
    expect(context.wrapper.findAll('li code')).toHaveLength(0)
    context.wrapper.unmount()
  })

  it('reports QR-generation errors and opens the manual setup key fallback', async () => {
    vi.spyOn(QRCode, 'toString').mockImplementationOnce(() =>
      Promise.reject(new Error('Encoding failed')),
    )
    const context = await setup()
    const secret = 'C'.repeat(32)
    context.fetch.mockResolvedValueOnce(
      json({ accessToken: null, challenge: 'C'.repeat(64), setupSecret: secret }),
    )
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.ui.notification.value?.message).toBe('auth.two.factor.qr.failed')
    expect(context.wrapper.find('img').exists()).toBe(false)
    expect(context.wrapper.find('details').attributes('open')).toBeDefined()
    expect(context.wrapper.find('input[readonly]').element).toHaveProperty('value', secret)
    expect(context.auth.authenticated.value).toBe(false)
    expect(context.fetch).toHaveBeenCalledTimes(3)
    context.wrapper.unmount()
  })

  it('discards a pending QR image when enrollment is cancelled', async () => {
    let resolve!: (svg: string) => void
    const encoding = new Promise<string>((done) => {
      resolve = done
    })
    vi.spyOn(QRCode, 'toString').mockImplementationOnce(() => encoding)
    const context = await setup()
    context.fetch.mockResolvedValueOnce(
      json({
        accessToken: null,
        challenge: 'D'.repeat(64),
        setupSecret: 'D'.repeat(32),
      }),
    )
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    await context.wrapper.find('form').findAll('button')[1]!.trigger('click')
    resolve('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    await flushPromises()
    expect(context.wrapper.find('img').exists()).toBe(false)
    expect(context.wrapper.find('input[readonly]').exists()).toBe(false)
    expect(context.wrapper.findComponent(form).exists()).toBe(true)
    expect(context.auth.authenticated.value).toBe(false)
    expect(context.ui.notification.value).toBeUndefined()
    context.wrapper.unmount()
  })

  it('retains the restricted challenge on an invalid code and allows starting over', async () => {
    const encode = vi.spyOn(QRCode, 'toString')
    const context = await setup()
    const challenge = 'B'.repeat(64)
    context.fetch.mockResolvedValueOnce(json({ accessToken: null, challenge, setupSecret: null }))
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(encode).not.toHaveBeenCalled()
    expect(context.wrapper.find('img').exists()).toBe(false)
    context.fetch.mockResolvedValueOnce(json({}, 401))
    await context.wrapper.find('input[autocomplete="one-time-code"]').setValue('000000')
    await context.wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(context.ui.notification.value?.message).toBe('auth.two.factor.invalid')
    expect(context.auth.authenticated.value).toBe(false)
    expect(context.wrapper.find('form').exists()).toBe(true)
    const cancel = context.wrapper.find('form').findAll('button')[1]!
    await cancel.trigger('click')
    expect(context.wrapper.findComponent(form).exists()).toBe(true)
    expect(context.wrapper.find('input[autocomplete="one-time-code"]').exists()).toBe(false)
    context.wrapper.unmount()
  })

  it('hides password and sign-up controls when disabled by server policy', async () => {
    const context = await setup()
    context.fetch.mockResolvedValueOnce(
      json({
        user: null,
        providers: { password: false, google: true },
        signup: false,
        twoFactor: true,
      }),
    )
    await context.auth.getState()
    await flushPromises()
    expect(context.wrapper.findComponent(form).exists()).toBe(false)
    expect(context.wrapper.text()).not.toContain(messages['auth.signup'])
    expect(context.wrapper.text()).not.toContain(messages['auth.recover.title'])
    context.wrapper.unmount()
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
    const redirect = '/settings/account?redirect=%2Fsandbox'
    const context = await setup(`/login?google=conflict&redirect=${encodeURIComponent(redirect)}`)
    await flushPromises()
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'login-token' }))
      .mockResolvedValueOnce(json(authState({ userId: 7, username: 'ada' })))
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.router.currentRoute.value.path).toBe('/settings/account')
    expect(context.router.currentRoute.value.query.redirect).toBe('/sandbox')
    expect(context.fetch).toHaveBeenCalledTimes(4)
    context.router.beforeEach(createAuthGuard(context.router, context.auth))
    await context.router.push(`/login?google=conflict&redirect=${encodeURIComponent(redirect)}`)
    expect(context.router.currentRoute.value.path).toBe('/settings/account')
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
    expect(context.ui.loading.active.value).toBe(false)
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
    expect(context.ui.loading.has('auth')).toBe(false)
    expect(context.ui.loading.active.value).toBe(false)
    expect(context.router.currentRoute.value.path).toBe('/login')
    context.wrapper.unmount()
  })

  it('reports offline login errors and releases loading state', async () => {
    const context = await setup()
    context.fetch.mockRejectedValueOnce(new Error('Offline'))
    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.ui.notification.value?.message).toContain('Offline')
    expect(context.ui.loading.has('auth')).toBe(false)
    expect(context.ui.loading.active.value).toBe(false)
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
    expect(context.ui.loading.active.value).toBe(false)
    await loginForm.trigger('click')
    expect(loginForm.props('loading')).toBeUndefined()
    expect(context.ui.loading.has('auth.login')).toBe(true)
    expect(context.ui.loading.has('overlay.auth.login')).toBe(true)
    await loginForm.trigger('click')
    expect(context.fetch).toHaveBeenCalledTimes(3)
    finish(json({ accessToken: 'login-token' }))
    await flushPromises()
    expect(loginForm.props('loading')).toBeUndefined()
    expect(context.ui.loading.active.value).toBe(false)
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
    expect(context.ui.loading.active.value).toBe(false)
    context.wrapper.unmount()
  })
})
