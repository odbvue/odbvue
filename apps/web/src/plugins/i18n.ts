import { createI18n } from 'vue-i18n'
import messages from '@intlify/unplugin-vue-i18n/messages'

const pendingKeys = new Set<string>()

export default createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages,
  missing: (locale: string, key: string) => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return

    const cacheKey = `${locale}:${key}`
    if (pendingKeys.has(cacheKey)) return
    pendingKeys.add(cacheKey)

    fetch('/i18n-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { locale, key, value: key } }), // Send key as initial value
    }).finally(() => pendingKeys.delete(cacheKey))
  },
})
