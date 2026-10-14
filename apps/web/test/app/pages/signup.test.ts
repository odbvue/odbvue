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
import Signup from '@/app/pages/signup.vue'
import ConfirmEmail from '@/app/pages/confirm-email.vue'

const session = vi.hoisted((): { auth?: Auth } => ({}))
vi.mock('@/capabilities/auth', async (importOriginal) => {
  const module = await importOriginal<typeof import('@/capabilities/auth')>()
  return { ...module, useAuth: () => session.auth }
})

const credentials = {
  email: 'ada+signup@example.com',
  fullName: 'Ada Lovelace',
  password: 'a strong password!',
  passwordRepeat: 'a strong password!',
}
const form = defineComponent({
  props: ['options', 'data'],
  emits: ['submit'],
  template: '<button @click="$emit(\'submit\', data)" />',
})
const button = defineComponent({
  props: ['to', 'disabled'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function setup(page: typeof Signup | typeof ConfirmEmail = Signup, hash = '') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: {} },
      { path: '/login', component: {} },
      { path: '/signup', component: {} },
      { path: '/confirm-email', component: {} },
    ],
  })
  await router.push(page === Signup ? '/signup?redirect=/' : `/confirm-email${hash}`)
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json({}, 401))
  const auth = createAuth({ http: createHttpClient({ fetch }) })
  session.auth = auth
  await auth.restore()
  const ui = useUi()
  ui.clear()
  const wrapper = mount(page, {
    global: {
      plugins: [createState(), i18n, router],
      stubs: {
        VOvGoogleSignIn: true,
        VOvForm: form,
        VBtn: button,
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

describe('signup and email confirmation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'definePage',
      vi.fn((definition: { meta: Record<string, unknown> }) => {
        validatePageMeta(definition.meta, 'signup/confirmation page')
      }),
    )
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses exactly four fields, accepts plus-addressing, and validates password matching and length', async () => {
    const { wrapper } = await setup()
    const options: OvFormOptions = wrapper.findComponent(form).props('options')
    expect(options.fields.map((field) => field.name)).toEqual([
      'email',
      'fullName',
      'password',
      'passwordRepeat',
    ])
    const email = options.fields[0]!
    for (const rule of email.rules ?? []) {
      expect(OvRuleValidate(credentials.email, rule.type, rule.params)).toBe(true)
    }
    const password = options.fields[2]!
    const length = password.rules?.find((rule) => rule.type === 'min-length')
    expect(OvRuleValidate('1234567', length?.type, length?.params)).toBe(false)
    expect(OvRuleValidate('12345678', length?.type, length?.params)).toBe(true)
    expect(wrapper.findComponent({ name: 'VOvGoogleSignIn' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('sends signup without logging in or persisting credentials and shows email instructions', async () => {
    const { wrapper, fetch, auth, ui } = await setup()
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    wrapper
      .findComponent(form)
      .vm.$emit('submit', { ...credentials, email: ` ${credentials.email} ` })
    await flushPromises()
    const [url, options] = fetch.mock.calls[1]!
    expect(String(url)).toContain('/auth/signup')
    expect(JSON.parse(String(options?.body))).toEqual(credentials)
    expect(options?.credentials).toBe('omit')
    expect(auth.authenticated.value).toBe(false)
    expect(auth.accessToken.value).toBeNull()
    expect(wrapper.findComponent(form).exists()).toBe(false)
    expect(wrapper.text()).toContain('auth.signup.check.email')
    expect(ui.loading.value).toBe(false)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    wrapper.unmount()
  })

  it.each([
    [409, 'auth.signup.email.exists'],
    [429, 'auth.signup.too.many.requests'],
  ])('reports HTTP %s and clears passwords while preserving identity', async (status, message) => {
    const { wrapper, fetch, ui } = await setup()
    fetch.mockResolvedValueOnce(json({}, status))
    wrapper.findComponent(form).vm.$emit('submit', credentials)
    await flushPromises()
    expect(ui.notification.value?.message).toBe(message)
    expect(wrapper.findComponent(form).props('data')).toEqual({
      email: credentials.email,
      fullName: credentials.fullName,
      password: '',
      passwordRepeat: '',
    })
    expect(ui.loading.value).toBe(false)
    wrapper.unmount()
  })

  it('rejects mismatched passwords without a request', async () => {
    const { wrapper, fetch, ui } = await setup()
    wrapper.findComponent(form).vm.$emit('submit', { ...credentials, passwordRepeat: 'different' })
    await flushPromises()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(ui.notification.value?.message).toBe('auth.password.mismatch')
    wrapper.unmount()
  })

  it('prevents duplicate submissions and does not show success on delivery failure', async () => {
    const { wrapper, fetch, ui, auth } = await setup()
    let finish!: (response: Response) => void
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    wrapper.findComponent(form).vm.$emit('submit', credentials)
    wrapper.findComponent(form).vm.$emit('submit', credentials)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(ui.loading.value).toBe(true)
    finish(json({}, 422))
    await flushPromises()
    expect(wrapper.findComponent(form).exists()).toBe(true)
    expect(ui.notification.value?.type).toBe('error')
    expect(auth.loading.value).toBe(false)
    expect(ui.loading.value).toBe(false)
    wrapper.unmount()
  })

  it('removes the token from the URL and waits for an explicit confirmation click', async () => {
    const token = 'A'.repeat(64)
    const { wrapper, fetch, router, auth } = await setup(ConfirmEmail, `#token=${token}`)
    expect(router.currentRoute.value.hash).toBe('')
    expect(fetch).toHaveBeenCalledTimes(1)
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await wrapper.findComponent(button).trigger('click')
    await flushPromises()
    expect(JSON.parse(String(fetch.mock.calls[1]![1]?.body))).toEqual({ token })
    expect(wrapper.text()).toContain('auth.confirm.success')
    expect(auth.authenticated.value).toBe(false)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    wrapper.unmount()
  })

  it.each(['', '#token=bad'])(
    'rejects missing or malformed links without posting',
    async (hash) => {
      const { wrapper, fetch } = await setup(ConfirmEmail, hash)
      expect(wrapper.text()).toContain('auth.confirm.invalid')
      expect(fetch).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    },
  )

  it('reports used or expired tokens without enabling a session', async () => {
    const { wrapper, fetch, auth, ui } = await setup(ConfirmEmail, `#token=${'A'.repeat(64)}`)
    fetch.mockResolvedValueOnce(json({}, 422))
    await wrapper.findComponent(button).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('auth.confirm.invalid')
    expect(auth.authenticated.value).toBe(false)
    expect(ui.loading.value).toBe(false)
    wrapper.unmount()
  })
})
