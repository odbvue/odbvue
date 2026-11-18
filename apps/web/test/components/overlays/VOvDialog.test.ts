import { describe, it, expect, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import VOvDialog from '@/components/overlays/VOvDialog.vue'
import { globalPlugins } from '../../support/components.setup'
import { createI18n } from 'vue-i18n'
import en from '@/app/i18n/en.json'
import de from '@/app/i18n/de.json'
import fr from '@/app/i18n/fr.json'

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
  it.each(['en', 'de', 'fr'] as const)('translates shared dialog actions in %s', (locale) => {
    const messages = { en, de, fr }
    wrapper = mount(VOvDialog, {
      props: { modelValue: true, copyable: true, closeable: true, content: 'Audit details' },
      global: {
        plugins: [createI18n({ legacy: false, locale, messages })],
      },
      attachTo: document.body,
    })
    const buttons = Array.from(
      document.body.querySelectorAll('button'),
      (button) => button.textContent,
    )
    expect(buttons).toContain(messages[locale]['copy.to.clipboard'])
    expect(buttons).toContain(messages[locale].close)
    expect(buttons).not.toContain('copy.to.clipboard')
  })

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
    expect(w.emitted('update:modelValue')).toEqual([[false]])
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
