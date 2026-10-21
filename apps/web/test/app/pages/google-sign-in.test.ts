import { authState } from '../../auth-state'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAuth, type Auth } from '@/capabilities/auth'
import { createHttpClient } from '@/capabilities/http/core'
import { createState } from '@/capabilities/state'
import { i18n } from '@/capabilities/i18n'
import { useUi } from '@/capabilities/ui'
import GoogleSignIn from '@/components/auth/VOvGoogleSignIn.vue'

const session = vi.hoisted((): { auth?: Auth } => ({}))
vi.mock('@/capabilities/auth', async (importOriginal) => {
  const module = await importOriginal<typeof import('@/capabilities/auth')>()
  return { ...module, useAuth: () => session.auth }
})

const button = defineComponent({
  props: ['disabled'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function setup(enabled = true, redirect = '/sandbox', configError = false, ready = true) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: {} },
      { path: '/login', component: {} },
      { path: '/sandbox', component: {} },
    ],
  })
  await router.push({ path: '/login', query: { redirect } })
  const fetch = vi.fn<typeof globalThis.fetch>()
  const auth = createAuth({ http: createHttpClient({ fetch }) })
  session.auth = auth
  const ui = useUi()
  ui.clear()
  fetch
    .mockResolvedValueOnce(json({}, 401))
    .mockResolvedValueOnce(json(configError ? {} : authState(null, enabled)))
  if (ready) {
    try {
      await auth.restore()
    } catch (error) {
      ui.error(error)
    }
  }
  const wrapper = mount(GoogleSignIn, {
    global: { plugins: [createState(), i18n, router], stubs: { VBtn: button } },
  })
  await flushPromises()
  fetch.mockClear()
  return { wrapper, fetch, auth, ui }
}

describe('shared Google sign-in button', () => {
  const assign = vi.fn<(url: string | URL) => void>()
  beforeEach(() => {
    assign.mockReset()
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

  it('hides the button when Google sign-in is disabled', async () => {
    const { wrapper } = await setup(false)
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('reports configuration failures using standard UI feedback', async () => {
    const { wrapper, ui } = await setup(true, '/', true)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(ui.notification.value?.type).toBe('error')
    expect(ui.notification.value?.message).toContain('authentication state')
    wrapper.unmount()
  })

  it('hides starts until authentication capabilities are loaded', async () => {
    const { wrapper, fetch } = await setup(true, '/', false, false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([
    ['/sandbox', '/sandbox'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/login', '/'],
    ['/missing-route', '/'],
  ])('sanitizes %s before starting and navigates only to Google', async (redirect, expected) => {
    const { wrapper, fetch, auth } = await setup(true, redirect)
    const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=server'
    fetch.mockResolvedValueOnce(json({ authorizationUrl }))
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledTimes(1)
    const [, options] = fetch.mock.calls[0]!
    expect(options?.credentials).toBe('include')
    expect(JSON.parse(String(options?.body))).toEqual({ redirect: expected })
    expect(assign).toHaveBeenCalledWith(authorizationUrl)
    expect(auth.accessToken.value).toBeNull()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('blocks duplicate starts while the backend request is pending', async () => {
    const { wrapper, fetch, auth } = await setup()
    let finish!: (response: Response) => void
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    wrapper.findComponent(button).vm.$emit('click')
    wrapper.findComponent(button).vm.$emit('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(auth.loading.value).toBe(true)
    finish(json({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth' }))
    await flushPromises()
    expect(assign).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('never navigates to an arbitrary backend URL and allows retry after failure', async () => {
    const { wrapper, fetch, ui } = await setup()
    fetch.mockResolvedValueOnce(json({ authorizationUrl: 'https://evil.example' }))
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(assign).not.toHaveBeenCalled()
    expect(ui.notification.value?.message).toBe('Invalid Google authorization URL.')
    expect(ui.loading.value).toBe(false)
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    fetch.mockResolvedValueOnce(json({}, 503))
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(ui.notification.value?.type).toBe('error')
    expect(ui.loading.value).toBe(false)
    wrapper.unmount()
  })
})
