import { describe, it, expect, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import VOvDialog from '../../src/capabilities/ui/components/VOvDialog.vue'
import { globalPlugins } from './setup'

let wrapper: VueWrapper

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

function mountDialog(props = {}) {
  wrapper = mount(VOvDialog, {
    props: { modelValue: true, ...props },
    global: { plugins: globalPlugins },
    attachTo: document.body,
  })
  return wrapper
}

describe('VOvDialog', () => {
  it('renders with title', () => {
    mountDialog({ title: 'Test Title' })
    expect(document.body.textContent).toContain('Test Title')
  })

  it('renders content text', () => {
    mountDialog({
      title: 'Dialog',
      content: 'Hello content',
    })
    expect(document.body.textContent).toContain('Hello content')
  })

  it('renders subtitle', () => {
    mountDialog({
      title: 'Dialog',
      subtitle: 'Sub text',
    })
    expect(document.body.textContent).toContain('Sub text')
  })

  it('renders close button when closeable', () => {
    mountDialog({
      title: 'Dialog',
      closeable: true,
    })
    expect(document.body.textContent).toContain('close')
  })

  it('renders action buttons from string array', () => {
    mountDialog({
      title: 'Dialog',
      actions: ['ok', 'cancel'],
    })
    expect(document.body.textContent).toContain('ok')
    expect(document.body.textContent).toContain('cancel')
  })

  it('emits cancel when cancel action clicked', async () => {
    const w = mountDialog({
      title: 'Confirm',
      actions: ['cancel'],
      actionCancel: 'cancel',
    })
    const buttons = Array.from(document.body.querySelectorAll('button'))
    const cancelBtn = buttons.find((b) => b.textContent?.includes('cancel'))
    cancelBtn?.click()
    expect(w.emitted('cancel')).toBeTruthy()
  })

  it('emits submit when submit action clicked', async () => {
    const w = mountDialog({
      title: 'Confirm',
      actions: ['agree'],
      actionSubmit: 'agree',
    })
    const buttons = Array.from(document.body.querySelectorAll('button'))
    const btn = buttons.find((b) => b.textContent?.includes('agree'))
    btn?.click()
    expect(w.emitted('submit')).toBeTruthy()
  })

  it('closes dialog on close button click', async () => {
    const w = mountDialog({
      title: 'Dialog',
      closeable: true,
    })
    const buttons = Array.from(document.body.querySelectorAll('button'))
    const closeBtn = buttons.find((b) => b.textContent?.includes('close'))
    closeBtn?.click()
    expect(w.emitted('update:modelValue')).toBeTruthy()
  })
})
