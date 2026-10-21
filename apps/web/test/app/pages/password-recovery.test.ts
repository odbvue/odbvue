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
import { validatePageMeta } from '@/capabilities/routing/metadata'
import { OvRuleValidate, type OvFormOptions } from '@/components'
import RecoverPassword from '@/app/pages/recover-password.vue'
import ResetPassword from '@/app/pages/reset-password.vue'

const session = vi.hoisted((): { auth?: Auth } => ({}))
vi.mock('@/capabilities/auth', async (importOriginal) => {
  const module = await importOriginal<typeof import('@/capabilities/auth')>()
  return { ...module, useAuth: () => session.auth }
})

const form = defineComponent({
  props: ['options', 'data'],
  emits: ['submit'],
  template: '<button @click="$emit(\'submit\', data)" />',
})
const token = 'A'.repeat(64)
const passwords = { password: 'a strong password!', passwordRepeat: 'a strong password!' }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function setup(page = RecoverPassword, hash = '', authenticated = false) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: {} },
      { path: '/recover-password', component: {} },
      { path: '/reset-password', component: {} },
    ],
  })
  await router.push(page === RecoverPassword ? '/recover-password' : `/reset-password${hash}`)
  const fetch = vi.fn<typeof globalThis.fetch>()
  if (authenticated) {
    fetch
      .mockResolvedValueOnce(json({ accessToken: 'old-access' }))
      .mockResolvedValueOnce(json(authState({ userId: 7, username: 'ada@example.com' })))
  } else fetch.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json(authState()))
  const auth = createAuth({ http: createHttpClient({ fetch }) })
  session.auth = auth
  await auth.restore()
  const ui = useUi()
  ui.clear()
  const wrapper = mount(page, {
    global: {
      plugins: [createState(), i18n, router],
      stubs: {
        VOvForm: form,
        VBtn: { props: ['to'], template: '<a><slot /></a>' },
        VAlert: { template: '<div><slot /></div>' },
        VContainer: { template: '<div><slot /></div>' },
        VRow: { template: '<div><slot /></div>' },
        VCol: { template: '<div><slot /></div>' },
      },
    },
  })
  await flushPromises()
  return { wrapper, router, fetch, auth, ui }
}

describe('password recovery pages', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'definePage',
      vi.fn((definition: { meta: Record<string, unknown> }) => {
        validatePageMeta(definition.meta, 'password recovery page')
      }),
    )
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('validates email and sends a trimmed address anonymously with neutral instructions', async () => {
    const { wrapper, fetch, auth, ui } = await setup()
    const options: OvFormOptions = wrapper.findComponent(form).props('options')
    expect(options.fields.map((field) => field.name)).toEqual(['email'])
    for (const rule of options.fields[0]!.rules ?? []) {
      expect(OvRuleValidate('ada+reset@example.com', rule.type, rule.params)).toBe(true)
    }
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    wrapper.findComponent(form).vm.$emit('submit', { email: ' ada+reset@example.com ' })
    await flushPromises()
    expect(String(fetch.mock.calls[2]![0])).toContain('/auth/recover-password')
    expect(JSON.parse(String(fetch.mock.calls[2]![1]?.body))).toEqual({
      email: 'ada+reset@example.com',
    })
    expect(fetch.mock.calls[2]![1]?.credentials).toBe('omit')
    expect(wrapper.text()).toContain('auth.recover.sent')
    expect(wrapper.findComponent(form).exists()).toBe(false)
    expect(auth.authenticated.value).toBe(false)
    expect(ui.loading.value).toBe(false)
    wrapper.unmount()
  })

  it.each([429, 500])(
    'reports recovery HTTP %s without success and allows retry',
    async (status) => {
      const { wrapper, fetch, ui } = await setup()
      fetch.mockResolvedValueOnce(json({}, status))
      wrapper.findComponent(form).vm.$emit('submit', { email: 'ada@example.com' })
      await flushPromises()
      expect(wrapper.findComponent(form).exists()).toBe(true)
      expect(ui.notification.value?.type).toBe('error')
      expect(ui.loading.value).toBe(false)
      fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
      wrapper.findComponent(form).vm.$emit('submit', { email: 'ada@example.com' })
      await flushPromises()
      expect(wrapper.text()).toContain('auth.recover.sent')
      wrapper.unmount()
    },
  )

  it('removes the fragment, waits for submission, validates passwords, and clears local identity', async () => {
    const { wrapper, router, fetch, auth } = await setup(ResetPassword, `#token=${token}`, true)
    expect(router.currentRoute.value.hash).toBe('')
    expect(fetch).toHaveBeenCalledTimes(2)
    const options: OvFormOptions = wrapper.findComponent(form).props('options')
    expect(options.fields.map((field) => field.name)).toEqual(['password', 'passwordRepeat'])
    const rules = options.fields[0]!.rules!
    for (const value of ['1234567', 'x'.repeat(257)]) {
      expect(rules.every((rule) => OvRuleValidate(value, rule.type, rule.params))).toBe(false)
    }
    for (const value of ['12345678', 'x'.repeat(256)]) {
      expect(rules.every((rule) => OvRuleValidate(value, rule.type, rule.params))).toBe(true)
    }
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    wrapper.findComponent(form).vm.$emit('submit', passwords)
    await flushPromises()
    expect(String(fetch.mock.calls[2]![0])).toContain('/auth/reset-password')
    expect(JSON.parse(String(fetch.mock.calls[2]![1]?.body))).toEqual({ token, ...passwords })
    expect(fetch.mock.calls[2]![1]?.credentials).toBe('omit')
    expect(wrapper.text()).toContain('auth.reset.success')
    expect(auth.accessToken.value).toBeNull()
    expect(auth.user.value).toBeNull()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    wrapper.unmount()
  })

  it.each(['', '#token=bad', `#token=${'a'.repeat(64)}`])(
    'rejects malformed link %s without posting',
    async (hash) => {
      const { wrapper, fetch } = await setup(ResetPassword, hash)
      expect(wrapper.text()).toContain('auth.reset.invalid')
      expect(wrapper.findComponent(form).exists()).toBe(false)
      expect(fetch).toHaveBeenCalledTimes(2)
      wrapper.unmount()
    },
  )

  it('rejects mismatched passwords without posting and clears the form', async () => {
    const { wrapper, fetch, ui } = await setup(ResetPassword, `#token=${token}`)
    wrapper.findComponent(form).vm.$emit('submit', { ...passwords, passwordRepeat: 'different' })
    await flushPromises()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(ui.notification.value?.message).toBe('auth.password.mismatch')
    expect(wrapper.findComponent(form).props('data')).toEqual({ password: '', passwordRepeat: '' })
    wrapper.unmount()
  })

  it('reports expired or used tokens and offers a fresh recovery link', async () => {
    const { wrapper, fetch, auth } = await setup(ResetPassword, `#token=${token}`)
    fetch.mockResolvedValueOnce(json({ code: 'PASSWORD_RESET_INVALID' }, 422))
    wrapper.findComponent(form).vm.$emit('submit', passwords)
    await flushPromises()
    expect(wrapper.text()).toContain('auth.reset.invalid')
    expect(wrapper.text()).toContain('auth.recover.action')
    expect(auth.authenticated.value).toBe(false)
    wrapper.unmount()
  })

  it.each([
    [422, 'PASSWORD_RESET_PASSWORD_INVALID', 'auth.password.length'],
    [422, 'PASSWORD_RESET_PASSWORD_MISMATCH', 'auth.password.mismatch'],
    [429, 'TOO_MANY_REQUESTS', 'auth.signup.too.many.requests'],
    [500, 'INTERNAL_SERVER_ERROR', undefined],
  ])('keeps the token on HTTP %s/%s and clears passwords', async (status, code, message) => {
    const { wrapper, fetch, ui } = await setup(ResetPassword, `#token=${token}`)
    fetch.mockResolvedValueOnce(json({ code }, status))
    wrapper.findComponent(form).vm.$emit('submit', passwords)
    await flushPromises()
    expect(wrapper.findComponent(form).props('data')).toEqual({ password: '', passwordRepeat: '' })
    expect(ui.notification.value?.type).toBe('error')
    if (message) expect(ui.notification.value?.message).toBe(message)
    expect(ui.loading.value).toBe(false)
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    wrapper.findComponent(form).vm.$emit('submit', passwords)
    await flushPromises()
    expect(JSON.parse(String(fetch.mock.calls[2]![1]?.body))).toEqual({ token, ...passwords })
    expect(wrapper.text()).toContain('auth.reset.success')
    wrapper.unmount()
  })

  it.each([RecoverPassword, ResetPassword])(
    'prevents duplicate submissions while loading',
    async (page) => {
      const { wrapper, fetch, auth } = await setup(page, `#token=${token}`)
      let finish!: (response: Response) => void
      fetch.mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      )
      const values = page === RecoverPassword ? { email: 'ada@example.com' } : passwords
      wrapper.findComponent(form).vm.$emit('submit', values)
      wrapper.findComponent(form).vm.$emit('submit', values)
      expect(fetch).toHaveBeenCalledTimes(3)
      finish(new Response(null, { status: 204 }))
      await flushPromises()
      expect(auth.loading.value).toBe(false)
      wrapper.unmount()
    },
  )
})
