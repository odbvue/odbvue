import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import Emails from '@/modules/sandbox/pages/capabilities/emails.vue'

const authenticated = ref(true)
const admin = ref(true)
type MockResponse = { data: unknown; error: Error | null }
const get = vi.fn<(url: string) => Promise<MockResponse>>()
const post = vi.fn<(url: string, body?: unknown) => Promise<MockResponse>>()
const upload = vi.fn<(url: string, file: File) => Promise<MockResponse>>()
vi.mock('@/capabilities/auth', () => ({
  useAuth: () => ({ authenticated, hasRole: () => admin.value }),
}))
vi.mock('@/capabilities/http', () => ({
  useHttp: () => ({ get, post, upload }),
}))

const textField = defineComponent({
  props: ['modelValue', 'label', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<input :aria-label="label" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const textarea = defineComponent({
  props: ['modelValue', 'label', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<textarea :aria-label="label" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const fileInput = defineComponent({
  props: ['modelValue', 'errorMessages', 'disabled'],
  emits: ['update:modelValue'],
  template: '<div class="file-input">{{ errorMessages }}</div>',
})
const button = defineComponent({
  props: ['disabled', 'loading', 'type'],
  template: '<button :disabled="disabled" :type="type || \'button\'"><slot /></button>',
})
const alert = defineComponent({
  props: ['type', 'text'],
  template: '<div role="alert"><slot />{{ text }}</div>',
})
const failedItem = {
  id: 'queued-id',
  subject: 'Test subject',
  status: 'E',
  priority: 3,
  attempts: 1,
  created: '2026-10-10T00:00:00Z',
  delivered: null,
  postponed: '2026-10-10T00:05:00Z',
  error: 'SMTP authentication failed',
}

async function setup() {
  const wrapper = mount(Emails, {
    global: {
      stubs: {
        VContainer: { template: '<div><slot /></div>' },
        VChip: { template: '<span><slot /></span>' },
        VTable: { template: '<table><slot /></table>' },
        VTextField: textField,
        VTextarea: textarea,
        VFileInput: fileInput,
        VSelect: true,
        VBtn: button,
        VAlert: alert,
      },
    },
  })
  await flushPromises()
  return wrapper
}

async function fill(wrapper: Awaited<ReturnType<typeof setup>>) {
  await wrapper.get('[aria-label="Recipient email"]').setValue('recipient@example.com')
  await wrapper.get('[aria-label="Subject"]').setValue('Test subject')
  await wrapper.get('[aria-label="HTML content"]').setValue('<p>Hello!</p>')
}

describe('sandbox Emails page', () => {
  beforeEach(() => {
    vi.stubGlobal('definePage', vi.fn())
    authenticated.value = true
    admin.value = true
    get.mockReset().mockResolvedValue({ data: { items: [] }, error: null })
    post.mockReset().mockResolvedValue({ data: { id: 'sent-id' }, error: null })
    upload.mockReset().mockResolvedValue({ data: { id: 'file-id' }, error: null })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends HTML using the sandbox endpoint and refreshes history', async () => {
    const wrapper = await setup()
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(post).toHaveBeenCalledWith('/sandbox/emails', {
      address: 'recipient@example.com',
      name: null,
      subject: 'Test subject',
      content: '<p>Hello!</p>',
      priority: 3,
      attachmentId: null,
    })
    expect(get).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Email sent-id accepted by the SMTP server.')
    wrapper.unmount()
  })

  it('uploads an optional attachment first and passes its ID to email delivery', async () => {
    const wrapper = await setup()
    await fill(wrapper)
    const file = new File(['attachment'], 'test.txt', { type: 'text/plain' })
    wrapper.getComponent(fileInput).vm.$emit('update:modelValue', file)
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(upload).toHaveBeenCalledWith('/sandbox/storage', file)
    expect(post).toHaveBeenCalledWith(
      '/sandbox/emails',
      expect.objectContaining({ attachmentId: 'file-id' }),
    )
    expect(wrapper.getComponent(fileInput).props('modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it.each([
    [10 * 1024 * 1024, false],
    [10 * 1024 * 1024 + 1, true],
  ])('enforces the exact attachment limit at %s bytes', async (size, blocked) => {
    const wrapper = await setup()
    await fill(wrapper)
    const file = new File(['x'], 'large.bin')
    Object.defineProperty(file, 'size', { value: size })
    wrapper.getComponent(fileInput).vm.$emit('update:modelValue', file)
    await flushPromises()
    const send = wrapper.get('button[type="submit"]')
    expect(send.attributes('disabled') !== undefined).toBe(blocked)
    expect(wrapper.text().includes('Maximum attachment size is 10 MiB.')).toBe(blocked)
    wrapper.unmount()
  })

  it('does not send when the upload fails and surfaces the error', async () => {
    const wrapper = await setup()
    await fill(wrapper)
    upload.mockResolvedValueOnce({ data: null, error: new Error('Upload failed') })
    wrapper.getComponent(fileInput).vm.$emit('update:modelValue', new File(['x'], 'test.txt'))
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Upload failed')
    wrapper.unmount()
  })

  it('preserves SMTP acceptance when history refresh fails', async () => {
    const wrapper = await setup()
    await fill(wrapper)
    get.mockResolvedValueOnce({ data: null, error: new Error('History unavailable') })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Email sent-id accepted by the SMTP server.')
    expect(wrapper.text()).toContain('History refresh failed: History unavailable')
    expect(post).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('preserves send failure when the history refresh also fails', async () => {
    const wrapper = await setup()
    await fill(wrapper)
    post.mockResolvedValueOnce({ data: null, error: new Error('SMTP unavailable') })
    get.mockResolvedValueOnce({ data: null, error: new Error('History unavailable') })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('SMTP unavailable')
    expect(wrapper.text()).toContain('History refresh failed: History unavailable')
    expect(wrapper.text()).toContain('use Retry')
    wrapper.unmount()
  })

  it('shows persisted SMTP failures and retries the existing queue entry', async () => {
    const wrapper = await setup()
    await fill(wrapper)
    post.mockResolvedValueOnce({ data: null, error: new Error('SMTP authentication failed') })
    get.mockResolvedValueOnce({ data: { items: [failedItem] }, error: null })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('SMTP authentication failed')
    expect(wrapper.text()).toContain('queued-id')
    const retry = wrapper.findAll('button').find((candidate) => candidate.text() === 'Retry')!
    await retry.trigger('click')
    await flushPromises()
    expect(post).toHaveBeenLastCalledWith('/sandbox/emails/queued-id/send')
    expect(wrapper.text()).toContain('Email queued-id accepted by the SMTP server.')
    wrapper.unmount()
  })

  it('does not re-upload the same file after a failed send', async () => {
    const wrapper = await setup()
    await fill(wrapper)
    wrapper.getComponent(fileInput).vm.$emit('update:modelValue', new File(['x'], 'test.txt'))
    await flushPromises()
    post.mockResolvedValueOnce({ data: null, error: new Error('SMTP failed') })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(upload).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenLastCalledWith(
      '/sandbox/emails',
      expect.objectContaining({ attachmentId: 'file-id' }),
    )
    wrapper.unmount()
  })

  it('blocks duplicate submissions while SMTP delivery is pending', async () => {
    const wrapper = await setup()
    await fill(wrapper)
    let finish!: (value: MockResponse) => void
    post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(post).toHaveBeenCalledTimes(1)
    finish({ data: { id: 'sent-id' }, error: null })
    await flushPromises()
    wrapper.unmount()
  })

  it.each([false, true])(
    'does not access emails without administrator authentication (%s)',
    async (signedIn) => {
      authenticated.value = signedIn
      admin.value = false
      const wrapper = await setup()
      expect(get).not.toHaveBeenCalled()
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('Administrator sign-in required')
      wrapper.unmount()
    },
  )

  it('never offers retry for messages accepted by SMTP', async () => {
    get.mockResolvedValueOnce({
      data: { items: [{ ...failedItem, status: 'S', error: null }] },
      error: null,
    })
    const wrapper = await setup()
    expect(wrapper.text()).toContain('Sent')
    expect(wrapper.findAll('button').some((candidate) => candidate.text() === 'Retry')).toBe(false)
    wrapper.unmount()
  })
})
