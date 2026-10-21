import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type RouteMeta } from 'vue-router'
import { createAuth, type Auth } from '@/capabilities/auth'
import { createHttpClient } from '@/capabilities/http/core'
import { createAuthGuard } from '@/capabilities/routing/auth'
import { createState } from '@/capabilities/state'
import { i18n } from '@/capabilities/i18n'
import { useUi } from '@/capabilities/ui'
import Account from '@/app/pages/account.vue'

const session = vi.hoisted((): { auth?: Auth } => ({}))
vi.mock('@/capabilities/auth', async (importOriginal) => {
  const module = await importOriginal<typeof import('@/capabilities/auth')>()
  return { ...module, useAuth: () => session.auth }
})

const button = defineComponent({
  props: ['disabled', 'loading', 'type'],
  template: '<button :disabled="disabled" :type="type || \'button\'"><slot /></button>',
})
const field = defineComponent({
  props: ['modelValue', 'disabled', 'type', 'label', 'readonly'],
  emits: ['update:modelValue'],
  template:
    '<input :type="type || \'text\'" :aria-label="label" :readonly="readonly" :disabled="disabled" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const passwordForm = defineComponent({
  props: ['options', 'data'],
  emits: ['submit'],
  template: '<div data-testid="password-form" />',
})
const container = { template: '<div><slot /></div>' }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function setup(
  options: {
    enabled?: boolean
    configError?: boolean
    ready?: boolean
    authenticated?: boolean
    location?: string
    passwordConnected?: boolean
    googleConnected?: boolean
    providerMetadata?: boolean
  } = {},
) {
  const user = {
    userId: 7,
    username: 'ada',
    displayName: 'Ada Lovelace',
    ...(options.providerMetadata === false
      ? {}
      : {
          passwordConnected: options.passwordConnected === false ? 0 : 1,
          googleConnected: options.googleConnected ? 1 : 0,
        }),
  }
  const fetch = vi.fn<typeof globalThis.fetch>()
  const auth = createAuth({ http: createHttpClient({ fetch }) })
  session.auth = auth
  if (options.ready !== false) {
    if (options.authenticated === false) fetch.mockResolvedValueOnce(json({}, 401))
    else
      fetch
        .mockResolvedValueOnce(json({ accessToken: 'original-token' }))
        .mockResolvedValueOnce(json(user))
    await auth.restore()
  }
  fetch.mockImplementation(async (request) => {
    const url = request instanceof Request ? request.url : String(request)
    if (url.endsWith('/auth/me')) return json({ ...user, googleConnected: 1 })
    if (url.endsWith('/auth/google/config'))
      return json(options.configError ? {} : { enabled: options.enabled ?? true })
    throw new Error(`Unexpected account request: ${url}`)
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: {} },
      { path: '/login', component: {} },
      { path: '/sandbox', component: {} },
      { path: '/account', component: {}, meta: { access: 'authenticated', navigation: false } },
    ],
  })
  await router.push(options.location ?? '/account')
  const ui = useUi()
  ui.clear()
  const wrapper = mount(Account, {
    global: {
      plugins: [createState(), i18n, router],
      stubs: {
        VBtn: button,
        VTextField: field,
        VContainer: container,
        VRow: container,
        VCol: container,
        VAlert: container,
        VCard: container,
        VCardText: container,
        VCardTitle: container,
        VChip: container,
        VDivider: true,
        VFileInput: true,
        AuthAvatar: true,
        VOvForm: passwordForm,
      },
    },
  })
  await flushPromises()
  const initialRequests = fetch.mock.calls.map(([request]) =>
    request instanceof Request ? request.url : String(request),
  )
  fetch.mockClear()
  return { wrapper, fetch, auth, ui, router, initialRequests }
}

describe('explicit Google connection in account settings', () => {
  const assign = vi.fn<(url: string | URL) => void>()
  const page = vi.fn<(options: { meta: RouteMeta }) => void>()
  beforeEach(() => {
    assign.mockReset()
    page.mockReset()
    vi.stubGlobal('definePage', page)
    const originalWindow = window
    vi.stubGlobal(
      'window',
      new Proxy(originalWindow, {
        get(target, property, receiver) {
          if (property === 'location') return { assign }
          return Reflect.get(target, property, receiver)
        },
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('uses the authenticated page guard and returns anonymous visitors through login', async () => {
    const context = await setup({ authenticated: false })
    expect(page).toHaveBeenCalledWith({
      meta: { title: 'Profile', access: 'authenticated', navigation: false },
    })
    context.router.addRoute({ path: '/account', component: {}, meta: page.mock.calls[0]![0].meta })
    context.router.beforeEach(createAuthGuard(context.router, context.auth))
    await context.router.push('/')
    await context.router.push('/account')
    expect(context.router.currentRoute.value.path).toBe('/login')
    expect(context.router.currentRoute.value.query.redirect).toBe('/account')
    context.wrapper.unmount()
  })

  it('keeps the authenticated account route accessible', async () => {
    const context = await setup()
    context.router.beforeEach(createAuthGuard(context.router, context.auth))
    await context.router.push('/')
    await context.router.push('/account')
    expect(context.router.currentRoute.value.path).toBe('/account')
    context.wrapper.unmount()
  })

  it('hides Connect Google when disabled or configuration cannot be loaded', async () => {
    for (const options of [{ enabled: false }, { configError: true }]) {
      const context = await setup(options)
      expect(context.wrapper.find('form').exists()).toBe(false)
      if (options.configError) expect(context.ui.notification.value?.type).toBe('error')
      context.wrapper.unmount()
    }
  })

  it.each([{ googleConnected: true }, { passwordConnected: false }, { providerMetadata: false }])(
    'does not offer Google linking when provider state disallows it: %j',
    async (options) => {
      const context = await setup(options)
      expect(context.wrapper.find('form').exists()).toBe(false)
      expect(context.wrapper.findComponent(passwordForm).exists()).toBe(
        options.passwordConnected !== false && options.providerMetadata !== false,
      )
      if (options.googleConnected)
        expect(context.wrapper.text()).toContain('auth.profile.google.connected')
      if (options.passwordConnected === false)
        expect(context.wrapper.text()).toContain('auth.profile.password.external')
      if (options.providerMetadata === false)
        expect(context.wrapper.text()).toContain('auth.profile.providers.unknown')
      expect(context.fetch).not.toHaveBeenCalled()
      context.wrapper.unmount()
    },
  )

  it.each([{ ready: false }, { authenticated: false }, {}])(
    'requires ready authenticated state and a password: %j',
    async (options) => {
      const context = await setup(options)
      if (options.ready === false || options.authenticated === false) {
        expect(context.wrapper.find('form').exists()).toBe(false)
      } else {
        expect(context.wrapper.get('form button').attributes('disabled')).toBeDefined()
        await context.wrapper.get('form').trigger('submit')
      }
      expect(context.fetch).not.toHaveBeenCalled()
      context.wrapper.unmount()
    },
  )

  it('submits only the fixed account destination, clears password, and blocks duplicate starts', async () => {
    const context = await setup({ location: '/account?redirect=https://evil.example' })
    await context.wrapper.get('form input[type="password"]').setValue('current-password')
    let finish!: (response: Response) => void
    context.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await context.wrapper.find('form').trigger('submit')
    await context.wrapper.find('form').trigger('submit')
    expect(context.fetch).toHaveBeenCalledTimes(1)
    expect(context.wrapper.get<HTMLInputElement>('form input[type="password"]').element.value).toBe(
      '',
    )
    expect(context.wrapper.get('form button').attributes('disabled')).toBeDefined()
    const [, options] = context.fetch.mock.calls[0]!
    expect(JSON.parse(String(options?.body))).toEqual({
      redirect: '/account',
      password: 'current-password',
    })
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      ['Bearer', 'original-token'].join(' '),
    )
    expect(options?.credentials).toBe('include')
    const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=link'
    finish(json({ authorizationUrl }))
    await flushPromises()
    expect(assign).toHaveBeenCalledWith(authorizationUrl)
    expect(context.auth.accessToken.value).toBe('original-token')
    expect(context.auth.user.value?.id).toBe(7)
    expect(context.wrapper.get('form button').attributes('disabled')).toBeDefined()
    context.wrapper.unmount()
  })

  it('carries the validated destination through a fresh explicit Google authorization', async () => {
    const context = await setup({ location: '/account?redirect=%2Fsandbox' })
    expect(context.wrapper.findAll('button')).toHaveLength(2)
    await context.wrapper.get('form input[type="password"]').setValue('current-password')
    context.fetch.mockResolvedValueOnce(
      json({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=fresh-link' }),
    )
    await context.wrapper.find('form').trigger('submit')
    await flushPromises()
    const [, options] = context.fetch.mock.calls[0]!
    expect(JSON.parse(String(options?.body))).toEqual({
      redirect: '/sandbox',
      password: 'current-password',
    })
    expect(assign).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?state=fresh-link',
    )
    context.wrapper.unmount()
  })

  it('continues to the original destination after a successful link without replacing the session', async () => {
    const context = await setup({ location: '/account?google=linked&redirect=%2Fsandbox' })
    expect(context.router.currentRoute.value.fullPath).toBe('/sandbox')
    expect(context.auth.accessToken.value).toBe('original-token')
    expect(context.auth.user.value?.id).toBe(7)
    expect(context.auth.user.value?.googleConnected).toBe(true)
    expect(context.initialRequests.filter((url) => url.endsWith('/auth/me'))).toHaveLength(2)
    expect(context.ui.notification.value?.message).toBe('auth.google.link.linked')
    context.wrapper.unmount()
  })

  it.each(['cancelled', 'error'])('keeps the destination for retry after %s', async (outcome) => {
    const context = await setup({ location: `/account?google=${outcome}&redirect=%2Fsandbox` })
    expect(context.router.currentRoute.value.path).toBe('/account')
    expect(context.router.currentRoute.value.query.redirect).toBe('/sandbox')
    expect(context.ui.notification.value?.type).toBe('error')
    expect(assign).not.toHaveBeenCalled()
    context.wrapper.unmount()
  })

  it('lets users continue without adding a Google identity', async () => {
    const context = await setup({ location: '/account?redirect=%2Fsandbox' })
    await context.wrapper.get('button[type="button"]').trigger('click')
    await flushPromises()
    expect(context.router.currentRoute.value.fullPath).toBe('/sandbox')
    expect(context.fetch).not.toHaveBeenCalled()
    context.wrapper.unmount()
  })

  it.each(['https://evil.example', '//evil.example', '/login', '/missing-route'])(
    'never follows unsafe callback destination %s',
    async (redirect) => {
      const context = await setup({
        location: `/account?google=linked&redirect=${encodeURIComponent(redirect)}`,
      })
      expect(context.router.currentRoute.value.path).toBe('/account')
      expect(context.wrapper.find('form').exists()).toBe(false)
      expect(context.wrapper.find('button[type="button"]').exists()).toBe(false)
      expect(assign).not.toHaveBeenCalled()
      context.wrapper.unmount()
    },
  )

  it.each([
    ['linked', 'success', 'auth.google.link.linked'],
    ['cancelled', 'error', 'auth.google.link.cancelled'],
    ['conflict', 'error', 'auth.google.link.conflict'],
    ['error', 'error', 'auth.google.link.failed'],
    ['untrusted detail', 'error', 'auth.google.link.failed'],
  ])('consumes outcome %s without changing sessions', async (outcome, type, message) => {
    const context = await setup({
      location: `/account?google=${encodeURIComponent(outcome)}&other=kept#section`,
    })
    expect(context.ui.notification.value).toMatchObject({ type, message })
    expect(context.router.currentRoute.value.query).toEqual({ other: 'kept' })
    expect(context.router.currentRoute.value.hash).toBe('#section')
    expect(context.auth.accessToken.value).toBe('original-token')
    expect(context.auth.user.value?.id).toBe(7)
    expect(context.initialRequests.filter((url) => url.endsWith('/auth/me'))).toHaveLength(
      outcome === 'linked' ? 2 : 1,
    )
    expect(context.fetch).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
    context.wrapper.unmount()
  })

  it.each([
    [401, 'auth.google.link.reauthenticate'],
    [403, 'auth.google.link.reauthenticate'],
    [409, 'auth.google.link.conflict'],
    [429, 'auth.too.many.requests'],
    [500, 'auth.google.link.failed'],
  ])('shows HTTP %s feedback, preserves auth and permits retry', async (status, message) => {
    const context = await setup()
    await context.wrapper.get('form input[type="password"]').setValue('password')
    context.fetch.mockResolvedValueOnce(json({}, status))
    await context.wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(context.ui.notification.value?.message).toBe(message)
    expect(context.ui.loading.value).toBe(false)
    expect(context.auth.authenticated.value).toBe(true)
    expect(context.auth.accessToken.value).toBe('original-token')
    await context.wrapper.get('form input[type="password"]').setValue('retry-password')
    expect(context.wrapper.get('form button').attributes('disabled')).toBeUndefined()
    expect(assign).not.toHaveBeenCalled()
    context.wrapper.unmount()
  })

  it('explains configuration errors without exposing backend details or replacing the session', async () => {
    const context = await setup()
    await context.wrapper.get('form input[type="password"]').setValue('password')
    context.fetch.mockResolvedValueOnce(json({ code: 'GOOGLE_CONFIG_INVALID' }, 422))
    await context.wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(context.ui.notification.value?.message).toBe('auth.google.link.configuration')
    expect(context.auth.accessToken.value).toBe('original-token')
    expect(context.auth.user.value?.id).toBe(7)
    expect(context.ui.loading.value).toBe(false)
    expect(assign).not.toHaveBeenCalled()
    context.wrapper.unmount()
  })

  it.each(['unsafe', 'offline'])(
    'preserves session after %s failure and never navigates',
    async (failure) => {
      const context = await setup()
      if (failure === 'unsafe')
        context.fetch.mockResolvedValueOnce(json({ authorizationUrl: 'https://evil.example' }))
      else context.fetch.mockRejectedValueOnce(new Error('Offline'))
      await context.wrapper.get('form input[type="password"]').setValue('password')
      await context.wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(context.ui.notification.value?.message).toBe('auth.google.link.failed')
      expect(context.auth.accessToken.value).toBe('original-token')
      expect(context.auth.user.value?.id).toBe(7)
      expect(context.auth.loading.value).toBe(false)
      expect(assign).not.toHaveBeenCalled()
      context.wrapper.unmount()
    },
  )
})
