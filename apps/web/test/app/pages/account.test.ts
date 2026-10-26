import { authConfig } from '../../auth-state'
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
import Account from '@/app/pages/settings/account.vue'

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

async function openGoogle(wrapper: ReturnType<typeof mount>) {
  const action = wrapper.findAll('button').find((item) => item.text() === 'auth.google.connect')
  if (action && !wrapper.find('form').exists()) await action.trigger('click')
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function setup(
  options: {
    enabled?: boolean
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
  const auth = createAuth({
    http: createHttpClient({ fetch }),
    onOperation: (operation) => useUi().loading.start(operation),
  })
  session.auth = auth
  if (options.ready !== false) {
    fetch.mockResolvedValueOnce(json(authConfig(options.enabled ?? true)))
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
    throw new Error(`Unexpected account request: ${url}`)
  })
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
  await router.push(options.location ?? '/settings/account')
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
        VAvatar: container,
        VImg: true,
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
      meta: { title: 'Account', access: 'authenticated', navigation: true },
    })
    context.router.addRoute({
      path: '/settings/account',
      component: {},
      meta: page.mock.calls[0]![0].meta,
    })
    context.router.beforeEach(createAuthGuard(context.router, context.auth))
    await context.router.push('/')
    await context.router.push('/settings/account')
    expect(context.router.currentRoute.value.path).toBe('/login')
    expect(context.router.currentRoute.value.query.redirect).toBe('/settings/account')
    context.wrapper.unmount()
  })

  it('keeps the authenticated account route accessible', async () => {
    const context = await setup()
    context.router.beforeEach(createAuthGuard(context.router, context.auth))
    await context.router.push('/')
    await context.router.push('/settings/account')
    expect(context.router.currentRoute.value.path).toBe('/settings/account')
    context.wrapper.unmount()
  })

  it('hides Connect Google when disabled', async () => {
    for (const options of [{ enabled: false }]) {
      const context = await setup(options)
      expect(context.wrapper.find('form').exists()).toBe(false)
      context.wrapper.unmount()
    }
  })

  it.each([{ googleConnected: true }, { passwordConnected: false }, { providerMetadata: false }])(
    'does not offer Google linking when provider state disallows it: %j',
    async (options) => {
      const context = await setup(options)
      expect(context.wrapper.find('form').exists()).toBe(false)
      expect(context.wrapper.findComponent(passwordForm).exists()).toBe(false)
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
        await openGoogle(context.wrapper)
        expect(
          context.wrapper.get('form button[type="submit"]').attributes('disabled'),
        ).toBeDefined()
        await context.wrapper.get('form').trigger('submit')
      }
      expect(context.fetch).not.toHaveBeenCalled()
      context.wrapper.unmount()
    },
  )

  it('submits only the fixed account destination, clears password, and blocks duplicate starts', async () => {
    const context = await setup({ location: '/settings/account?redirect=https://evil.example' })
    await openGoogle(context.wrapper)
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
    expect(context.wrapper.get('form button[type="submit"]').attributes('disabled')).toBeDefined()
    const [, options] = context.fetch.mock.calls[0]!
    expect(JSON.parse(String(options?.body))).toEqual({
      redirect: '/settings/account',
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
    expect(context.wrapper.get('form button[type="submit"]').attributes('disabled')).toBeDefined()
    context.wrapper.unmount()
  })

  it('carries the validated destination through a fresh explicit Google authorization', async () => {
    const context = await setup({ location: '/settings/account?redirect=%2Fsandbox' })
    expect(context.wrapper.find('form').exists()).toBe(true)
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
    const context = await setup({ location: '/settings/account?google=linked&redirect=%2Fsandbox' })
    expect(context.router.currentRoute.value.fullPath).toBe('/sandbox')
    expect(context.auth.accessToken.value).toBe('original-token')
    expect(context.auth.user.value?.id).toBe(7)
    expect(context.auth.user.value?.googleConnected).toBe(true)
    expect(context.initialRequests.filter((url) => url.endsWith('/auth/me'))).toHaveLength(2)
    expect(context.ui.notification.value?.message).toBe('auth.google.link.linked')
    context.wrapper.unmount()
  })

  it.each(['cancelled', 'error'])('keeps the destination for retry after %s', async (outcome) => {
    const context = await setup({
      location: `/settings/account?google=${outcome}&redirect=%2Fsandbox`,
    })
    expect(context.router.currentRoute.value.path).toBe('/settings/account')
    expect(context.router.currentRoute.value.query.redirect).toBe('/sandbox')
    expect(context.ui.notification.value?.type).toBe('error')
    expect(assign).not.toHaveBeenCalled()
    context.wrapper.unmount()
  })

  it('lets users continue without adding a Google identity', async () => {
    const context = await setup({ location: '/settings/account?redirect=%2Fsandbox' })
    await context.wrapper
      .findAll('button')
      .find((item) => item.text() === 'auth.google.link.skip')!
      .trigger('click')
    await flushPromises()
    expect(context.router.currentRoute.value.fullPath).toBe('/sandbox')
    expect(context.fetch).not.toHaveBeenCalled()
    context.wrapper.unmount()
  })

  it.each(['https://evil.example', '//evil.example', '/login', '/missing-route'])(
    'never follows unsafe callback destination %s',
    async (redirect) => {
      const context = await setup({
        location: `/settings/account?google=linked&redirect=${encodeURIComponent(redirect)}`,
      })
      expect(context.router.currentRoute.value.path).toBe('/settings/account')
      expect(context.wrapper.find('form').exists()).toBe(false)
      expect(context.wrapper.text()).not.toContain('auth.google.link.skip')
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
      location: `/settings/account?google=${encodeURIComponent(outcome)}&other=kept#section`,
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
    await openGoogle(context.wrapper)
    await context.wrapper.get('form input[type="password"]').setValue('password')
    context.fetch.mockResolvedValueOnce(json({}, status))
    await context.wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(context.ui.notification.value?.message).toBe(message)
    expect(context.ui.loading.active.value).toBe(false)
    expect(context.auth.authenticated.value).toBe(true)
    expect(context.auth.accessToken.value).toBe('original-token')
    await context.wrapper.get('form input[type="password"]').setValue('retry-password')
    expect(context.wrapper.get('form button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(assign).not.toHaveBeenCalled()
    context.wrapper.unmount()
  })

  it('explains configuration errors without exposing backend details or replacing the session', async () => {
    const context = await setup()
    await openGoogle(context.wrapper)
    await context.wrapper.get('form input[type="password"]').setValue('password')
    context.fetch.mockResolvedValueOnce(json({ code: 'GOOGLE_CONFIG_INVALID' }, 422))
    await context.wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(context.ui.notification.value?.message).toBe('auth.google.link.configuration')
    expect(context.auth.accessToken.value).toBe('original-token')
    expect(context.auth.user.value?.id).toBe(7)
    expect(context.ui.loading.active.value).toBe(false)
    expect(assign).not.toHaveBeenCalled()
    context.wrapper.unmount()
  })

  it.each(['unsafe', 'offline'])(
    'preserves session after %s failure and never navigates',
    async (failure) => {
      const context = await setup()
      await openGoogle(context.wrapper)
      if (failure === 'unsafe')
        context.fetch.mockResolvedValueOnce(json({ authorizationUrl: 'https://evil.example' }))
      else context.fetch.mockRejectedValueOnce(new Error('Offline'))
      await context.wrapper.get('form input[type="password"]').setValue('password')
      await context.wrapper.find('form').trigger('submit')
      await flushPromises()
      expect(context.ui.notification.value?.message).toBe('auth.google.link.failed')
      expect(context.auth.accessToken.value).toBe('original-token')
      expect(context.auth.user.value?.id).toBe(7)
      expect(context.ui.loading.has('auth')).toBe(false)
      expect(assign).not.toHaveBeenCalled()
      context.wrapper.unmount()
    },
  )

  it('shows one identity summary and keeps editing controls collapsed initially', async () => {
    const context = await setup()
    expect(context.wrapper.findAll('h2').map((heading) => heading.text())).toEqual([
      'Ada Lovelace',
      'auth.profile.security',
    ])
    expect(context.wrapper.text().match(/Ada Lovelace/g)).toHaveLength(1)
    expect(context.wrapper.findAll('p').filter((item) => item.text() === 'ada')).toHaveLength(1)
    expect(context.wrapper.find('input').exists()).toBe(false)
    expect(context.wrapper.findComponent(passwordForm).exists()).toBe(false)
    expect(context.wrapper.find('#profile-photo').exists()).toBe(false)
    expect(context.wrapper.find('form').exists()).toBe(false)
    context.wrapper.unmount()
  })

  it('reveals photo and password controls and clears password data when closed', async () => {
    const context = await setup()
    const photo = context.wrapper.get('[aria-controls="profile-photo"]')
    await photo.trigger('click')
    expect(photo.attributes('aria-expanded')).toBe('true')
    expect(context.wrapper.find('#profile-photo').exists()).toBe(true)
    await photo.trigger('click')
    expect(context.wrapper.find('#profile-photo').exists()).toBe(false)
    const password = context.wrapper.get('[aria-controls="profile-password"]')
    await password.trigger('click')
    expect(context.wrapper.findComponent(passwordForm).exists()).toBe(true)
    const data = context.wrapper.getComponent(passwordForm).props('data')
    data.currentPassword = 'private-password'
    await password.trigger('click')
    expect(context.wrapper.findComponent(passwordForm).exists()).toBe(false)
    await password.trigger('click')
    expect(context.wrapper.getComponent(passwordForm).props('data').currentPassword).toBe('')
    context.wrapper.unmount()
  })

  it('clears the Google password when closing and reopening the form', async () => {
    const context = await setup()
    await openGoogle(context.wrapper)
    await context.wrapper.get('form input').setValue('private-password')
    await context.wrapper.get('form button[type="button"]').trigger('click')
    expect(context.wrapper.find('form').exists()).toBe(false)
    await openGoogle(context.wrapper)
    expect(context.wrapper.get<HTMLInputElement>('form input').element.value).toBe('')
    context.wrapper.unmount()
  })
})
