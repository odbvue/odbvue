import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import Settings from '@/modules/sandbox/pages/capabilities/settings.vue'

const authenticated = ref(true)
type Response = { data: unknown; error: Error | null }
const get = vi.fn<(url: string) => Promise<Response>>()
const put = vi.fn<(url: string, body: unknown) => Promise<Response>>()
const remove = vi.fn<(url: string) => Promise<Response>>()
vi.mock('@/capabilities/auth', () => ({ useAuth: () => ({ authenticated }) }))
vi.mock('@/capabilities/http', () => ({
  useHttp: () => ({ get, put, delete: remove }),
}))

const field = defineComponent({
  props: ['modelValue', 'label', 'type'],
  emits: ['update:modelValue'],
  template:
    '<input :aria-label="label" :type="type" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const button = defineComponent({
  props: ['disabled'],
  template: '<button :disabled="disabled"><slot /></button>',
})
const slot = { template: '<div><slot /></div>' }
const setup = () =>
  mount(Settings, {
    global: {
      stubs: {
        VContainer: slot,
        VRow: slot,
        VCol: slot,
        VCard: slot,
        VCardText: slot,
        VCardActions: slot,
        VChip: slot,
        VTable: { template: '<table><slot /></table>' },
        VTextField: field,
        VBtn: button,
        VAlert: { props: ['text'], template: '<div role="alert">{{ text }}</div>' },
      },
    },
  })
const findButton = (wrapper: ReturnType<typeof setup>, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)!

describe('sandbox Settings secrets', () => {
  beforeEach(() => {
    vi.stubGlobal('definePage', vi.fn<() => void>())
    authenticated.value = true
    get.mockReset().mockResolvedValue({ data: { items: [] }, error: null })
    put.mockReset().mockResolvedValue({ data: null, error: null })
    remove.mockReset().mockResolvedValue({ data: null, error: null })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('preserves normal configuration reads and writes', async () => {
    get.mockResolvedValueOnce({ data: { value: 'smtp.example.com', meta: {} }, error: null })
    const wrapper = setup()
    await wrapper.get('[aria-label="ID"]').setValue('SMTP_HOST')
    await findButton(wrapper, 'Read').trigger('click')
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('[aria-label="Value"]').element.value).toBe(
      'smtp.example.com',
    )
    await findButton(wrapper, 'Write').trigger('click')
    await flushPromises()
    expect(put).toHaveBeenCalledWith('/sandbox/settings/SMTP_HOST', { value: 'smtp.example.com' })
    wrapper.unmount()
  })

  it('never prefills the mask and writes only a secret replacement', async () => {
    get.mockResolvedValueOnce({ data: { value: '********', meta: { secret: 'Y' } }, error: null })
    const wrapper = setup()
    await wrapper.get('[aria-label="ID"]').setValue('SMTP_PASSWORD')
    await findButton(wrapper, 'Read').trigger('click')
    await flushPromises()
    const input = wrapper.get<HTMLInputElement>('[aria-label="New secret value"]')
    expect(input.element.value).toBe('')
    expect(input.attributes('type')).toBe('password')
    expect(findButton(wrapper, 'Write').attributes('disabled')).toBeDefined()
    await input.setValue('replacement')
    await findButton(wrapper, 'Write').trigger('click')
    await flushPromises()
    expect(put).toHaveBeenCalledWith('/sandbox/settings/SMTP_PASSWORD', { value: 'replacement' })
    expect(input.element.value).toBe('')
    expect(wrapper.text()).toContain('Setting saved.')
    wrapper.unmount()
  })

  it('recognizes secret metadata on arbitrary listed settings', async () => {
    get.mockResolvedValueOnce({
      data: { items: [{ id: 'API_TOKEN', value: '********', meta: { secret: 'Y' } }] },
      error: null,
    })
    const wrapper = setup()
    await findButton(wrapper, 'Load').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('********')
    await wrapper.get('tbody tr').trigger('click')
    expect(wrapper.get<HTMLInputElement>('[aria-label="New secret value"]').element.value).toBe('')
    expect(findButton(wrapper, 'Write').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('recognizes secret metadata on arbitrary individual settings', async () => {
    get.mockResolvedValueOnce({ data: { value: '********', meta: { secret: 'Y' } }, error: null })
    const wrapper = setup()
    await wrapper.get('[aria-label="ID"]').setValue('API_TOKEN')
    await findButton(wrapper, 'Read').trigger('click')
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('[aria-label="New secret value"]').element.value).toBe('')
    wrapper.unmount()
  })

  it('clears an entered secret when the selected ID changes', async () => {
    const wrapper = setup()
    await wrapper.get('[aria-label="ID"]').setValue('SMTP_PASSWORD')
    await wrapper.get('[aria-label="New secret value"]').setValue('replacement')
    await wrapper.get('[aria-label="ID"]').setValue('SMTP_HOST')
    expect(wrapper.get<HTMLInputElement>('[aria-label="Value"]').element.value).toBe('')
    wrapper.unmount()
  })

  it.each(['AUTH_JWT_SECRET', 'AUTH_JWT_ISSUER', 'AUTH_JWT_EXPIRATION_SECONDS'])(
    'keeps trusted auth configuration read-only: %s',
    async (id) => {
      const wrapper = setup()
      await wrapper.get('[aria-label="ID"]').setValue(id)
      expect(findButton(wrapper, 'Write').attributes('disabled')).toBeDefined()
      expect(findButton(wrapper, 'Delete').attributes('disabled')).toBeDefined()
      expect(findButton(wrapper, 'Read').attributes('disabled')).toBeUndefined()
      if (id === 'AUTH_JWT_SECRET') {
        expect(wrapper.get('[aria-label="New secret value"]').attributes('type')).toBe('password')
      }
      expect(put).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
      wrapper.unmount()
    },
  )

  it('surfaces write failures without reporting success or discarding the replacement', async () => {
    put.mockResolvedValueOnce({ data: null, error: new Error('Encryption unavailable') })
    const wrapper = setup()
    await wrapper.get('[aria-label="ID"]').setValue('SMTP_PASSWORD')
    await wrapper.get('[aria-label="New secret value"]').setValue('replacement')
    await findButton(wrapper, 'Write').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Setting could not be saved.')
    expect(wrapper.text()).not.toContain('Setting saved.')
    expect(wrapper.get<HTMLInputElement>('[aria-label="New secret value"]').element.value).toBe(
      'replacement',
    )
    wrapper.unmount()
  })
})
