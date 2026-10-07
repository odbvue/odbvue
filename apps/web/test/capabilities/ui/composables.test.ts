import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useNotificationMessage } from '@/capabilities/ui'

enableAutoUnmount(afterEach)

function setup(initialMessage?: string) {
  const message = ref(initialMessage)
  const missing = vi.fn<(locale: string, key: string) => void>()
  const i18n = createI18n({
    legacy: false,
    locale: 'fr',
    fallbackLocale: 'en',
    missing,
    messages: {
      en: { 'auth.failed': 'Unable to sign in.', 'auth.fallback': 'Try again later.' },
      fr: { 'auth.failed': 'Connexion impossible.' },
    },
  })
  const wrapper = mount(
    defineComponent({
      setup() {
        const text = useNotificationMessage(message)
        return () => h('p', text.value)
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return { message, missing, wrapper }
}

describe('notification messages', () => {
  it('displays fetch errors verbatim without registering missing translations or rendering HTML', () => {
    const error = '[POST] "/api/auth/login": <no response> Failed to fetch'
    const { wrapper, missing } = setup(error)

    expect(wrapper.text()).toBe(error)
    expect(wrapper.find('p').element.children).toHaveLength(0)
    expect(missing).not.toHaveBeenCalled()
  })

  it('translates existing keys in the selected locale', () => {
    const { wrapper, missing } = setup('auth.failed')

    expect(wrapper.text()).toBe('Connexion impossible.')
    expect(missing).not.toHaveBeenCalled()
  })

  it('keeps fallback-locale translations working', () => {
    const { wrapper } = setup('auth.fallback')

    expect(wrapper.text()).toBe('Try again later.')
  })

  it('reacts to notification changes without collecting arbitrary messages', async () => {
    const { wrapper, message, missing } = setup('auth.failed')
    message.value = 'Service unavailable <503>'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('Service unavailable <503>')
    expect(missing).not.toHaveBeenCalled()

    message.value = undefined
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('')
    expect(missing).not.toHaveBeenCalled()
  })
})
