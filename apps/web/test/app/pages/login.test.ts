import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAuth, type Auth } from '@/app/auth'
import { createState } from '@/app/state'
import { i18n } from '@/app/i18n'
import { useHttp } from '@/app/http'
import { useUi } from '@/app/ui'
import Login from '@/app/pages/login.vue'

const session = vi.hoisted((): { auth?: Auth } => ({}))
vi.mock('@/app/auth', async (importOriginal) => {
  const module = await importOriginal<typeof import('@/app/auth')>()
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

async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: {} },
      { path: '/login', component: {} },
      { path: '/sandbox', component: {} },
    ],
  })
  await router.push('/login?redirect=/sandbox')
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json({}, 401))
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

  it('logs in, redirects, and keeps credentials out of storage', async () => {
    const context = await setup()
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'login-token' }))
      .mockResolvedValueOnce(json({ userId: 7, username: 'ada', permissions: ['settings.read'] }))

    await context.wrapper.findComponent(form).trigger('click')
    await flushPromises()
    expect(context.auth.authenticated.value).toBe(true)
    expect(context.auth.can('settings.read')).toBe(true)
    expect(context.router.currentRoute.value.path).toBe('/sandbox')
    const [, options] = context.fetch.mock.calls[1]!
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
    context.wrapper.unmount()
  })

  it('reflects auth loading and prevents duplicate submissions', async () => {
    const context = await setup()
    let finish!: (response: Response) => void
    context.fetch
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce(json({ userId: 7, username: 'ada' }))
    const loginForm = context.wrapper.findComponent(form)
    expect(loginForm.props('loading')).toBe(false)
    await loginForm.trigger('click')
    expect(loginForm.props('loading')).toBe(true)
    await loginForm.trigger('click')
    expect(context.fetch).toHaveBeenCalledTimes(2)
    finish(json({ accessToken: 'login-token' }))
    await flushPromises()
    expect(loginForm.props('loading')).toBe(false)
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
    context.wrapper.unmount()
  })
})
