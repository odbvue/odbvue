import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import Acl from '@/modules/sandbox/pages/capabilities/acl.vue'

const authenticated = ref(true)
const admin = ref(true)
type Response = { data: unknown; error: Error | null }
const get = vi.fn<(url: string) => Promise<Response>>()
const put = vi.fn<(url: string) => Promise<Response>>()
const remove = vi.fn<(url: string) => Promise<Response>>()
vi.mock('@/capabilities/auth', () => ({
  useAuth: () => ({ authenticated, hasRole: () => admin.value }),
}))
vi.mock('@/capabilities/http', () => ({
  useHttp: () => ({ get, put, delete: remove }),
}))

const field = defineComponent({
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template:
    '<input :aria-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const select = defineComponent({
  props: ['modelValue', 'label', 'items'],
  emits: ['update:modelValue'],
  template:
    '<select :aria-label="label" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item">{{ item }}</option></select>',
})
const button = defineComponent({
  props: ['disabled'],
  template: '<button :disabled="disabled"><slot /></button>',
})
const alert = defineComponent({
  props: ['text'],
  template: '<div role="alert">{{ text }}</div>',
})
const slot = { template: '<div><slot /></div>' }
const setup = () =>
  mount(Acl, {
    global: {
      stubs: {
        VContainer: slot,
        VRow: slot,
        VCol: slot,
        VCard: slot,
        VCardText: slot,
        VCardActions: slot,
        VTable: { template: '<table><slot /></table>' },
        VTextField: field,
        VSelect: select,
        VBtn: button,
        VAlert: alert,
      },
    },
  })
const findButton = (wrapper: ReturnType<typeof setup>, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)!

describe('sandbox Network ACL page', () => {
  beforeEach(() => {
    vi.stubGlobal('definePage', vi.fn())
    authenticated.value = true
    admin.value = true
    get.mockReset().mockResolvedValue({ data: { items: [] }, error: null })
    put.mockReset().mockResolvedValue({ data: null, error: null })
    remove.mockReset().mockResolvedValue({ data: null, error: null })
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['http', 443],
    ['smtp', 587],
    ['ldap', 636],
  ] as const)('uses the default %s port %i and refreshes after adding', async (protocol, port) => {
    const wrapper = setup()
    await wrapper.get('select').setValue(protocol)
    await wrapper.get('[aria-label="Host (no URL or wildcard)"]').setValue('api.example.com')
    await findButton(wrapper, 'Add').trigger('click')
    await flushPromises()
    expect(put).toHaveBeenCalledWith(`/sandbox/acl/${protocol}/api.example.com?port=${port}`)
    expect(get).toHaveBeenCalledWith('/sandbox/acl')
    expect(wrapper.text()).toContain('ACL grant updated.')
    wrapper.unmount()
  })

  it('uses an explicit SMTP port for removal', async () => {
    const wrapper = setup()
    await wrapper.get('select').setValue('smtp')
    await wrapper.get('[aria-label="Host (no URL or wildcard)"]').setValue('mail.example.com')
    await wrapper.get('[aria-label="Port (optional)"]').setValue('465')
    await findButton(wrapper, 'Remove').trigger('click')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('/sandbox/acl/smtp/mail.example.com?port=465')
    wrapper.unmount()
  })

  it.each([0, 65536, 443.5])('blocks invalid port %s', async (port) => {
    const wrapper = setup()
    await wrapper.get('[aria-label="Host (no URL or wildcard)"]').setValue('api.example.com')
    await wrapper.get('[aria-label="Port (optional)"]').setValue(String(port))
    expect(findButton(wrapper, 'Add').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, 'Remove').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it.each([1, 65535])('allows port boundary %s', async (port) => {
    const wrapper = setup()
    await wrapper.get('[aria-label="Host (no URL or wildcard)"]').setValue('api.example.com')
    await wrapper.get('[aria-label="Port (optional)"]').setValue(String(port))
    expect(findButton(wrapper, 'Add').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it.each(['https://api.example.com', '*.example.com', 'api.example.com '])(
    'blocks invalid host %s',
    async (host) => {
      const wrapper = setup()
      await wrapper.get('[aria-label="Host (no URL or wildcard)"]').setValue(host)
      expect(findButton(wrapper, 'Add').attributes('disabled')).toBeDefined()
      wrapper.unmount()
    },
  )

  it.each([
    [false, false],
    [true, false],
  ])('blocks non-admin access (%s, %s)', async (signedIn, isAdmin) => {
    authenticated.value = signedIn
    admin.value = isAdmin
    const wrapper = setup()
    await wrapper.get('[aria-label="Host (no URL or wildcard)"]').setValue('api.example.com')
    expect(
      wrapper
        .findAll('button')
        .every((candidate) => candidate.attributes('disabled') !== undefined),
    ).toBe(true)
    expect(wrapper.text()).toContain('admin role is required')
    wrapper.unmount()
  })

  it('surfaces mutation errors without loading or reporting success', async () => {
    put.mockResolvedValueOnce({ data: null, error: new Error('ACL permission denied') })
    const wrapper = setup()
    await wrapper.get('[aria-label="Host (no URL or wildcard)"]').setValue('api.example.com')
    await findButton(wrapper, 'Add').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('ACL permission denied')
    expect(wrapper.text()).not.toContain('ACL grant updated.')
    expect(get).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('reports an applied grant explicitly if the subsequent refresh fails', async () => {
    get.mockResolvedValueOnce({ data: null, error: new Error('List unavailable') })
    const wrapper = setup()
    await wrapper.get('[aria-label="Host (no URL or wildcard)"]').setValue('api.example.com')
    await findButton(wrapper, 'Add').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(
      'ACL grant updated, but refreshing the list failed: List unavailable',
    )
    expect(put).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('lists ranges and only selects exact-port grants', async () => {
    get.mockResolvedValueOnce({
      data: {
        items: [
          { host: 'range.example.com', lower_port: 440, upper_port: 450, privilege: 'HTTP' },
          { host: 'all.example.com', lower_port: null, upper_port: null, privilege: 'SMTP' },
          { host: 'mail.example.com', lower_port: 465, upper_port: 465, privilege: 'SMTP' },
        ],
      },
      error: null,
    })
    const wrapper = setup()
    await findButton(wrapper, 'Load').trigger('click')
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]!.findAll('td').map((cell) => cell.text())).toEqual([
      'range.example.com',
      '440',
      '450',
      'http',
    ])
    expect(rows[1]!.findAll('td').map((cell) => cell.text())).toEqual([
      'all.example.com',
      'All',
      'All',
      'smtp',
    ])
    expect(rows[2]!.findAll('td').map((cell) => cell.text())).toEqual([
      'mail.example.com',
      '465',
      '465',
      'smtp',
    ])
    await rows[0]!.trigger('click')
    expect(wrapper.getComponent(field).props('modelValue')).toBe('')
    await rows[1]!.trigger('click')
    expect(wrapper.getComponent(field).props('modelValue')).toBe('')
    await rows[2]!.trigger('click')
    await findButton(wrapper, 'Remove').trigger('click')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('/sandbox/acl/smtp/mail.example.com?port=465')
    wrapper.unmount()
  })

  it('displays and selects the exact HTTP and SMTP ports from the ORDS response', async () => {
    get.mockResolvedValueOnce({
      data: {
        items: [
          { host: 'api.chucknorris.io', lower_port: 443, upper_port: 443, privilege: 'HTTP' },
          { host: 'smtp.example.com', lower_port: 587, upper_port: 587, privilege: 'SMTP' },
        ],
      },
      error: null,
    })
    const wrapper = setup()
    await findButton(wrapper, 'Load').trigger('click')
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]!.findAll('td').map((cell) => cell.text())).toEqual([
      'api.chucknorris.io',
      '443',
      '443',
      'http',
    ])
    expect(rows[1]!.findAll('td').map((cell) => cell.text())).toEqual([
      'smtp.example.com',
      '587',
      '587',
      'smtp',
    ])
    await rows[0]!.trigger('click')
    expect(wrapper.get('[aria-label="Port (optional)"]').element).toHaveProperty('value', '443')
    await rows[1]!.trigger('click')
    expect(wrapper.get('[aria-label="Port (optional)"]').element).toHaveProperty('value', '587')
    expect(findButton(wrapper, 'Remove').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('reports missing port fields instead of presenting them as all-port grants', async () => {
    get.mockResolvedValueOnce({
      data: { items: [{ host: 'api.example.com', privilege: 'HTTP' }] },
      error: null,
    })
    const wrapper = setup()
    await findButton(wrapper, 'Load').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('ACL response contains missing or invalid port bounds.')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.find('tbody').text()).toContain('Nothing loaded.')
    wrapper.unmount()
  })
})
