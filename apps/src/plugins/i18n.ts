import { createI18n } from 'vue-i18n'
import messages from '@intlify/unplugin-vue-i18n/messages'

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  fallbackWarn: false,
  messages,
  missing: (locale: string, key: string) => {
    fetch('/i18n-add', {
      method: 'POST',
      body: JSON.stringify({
        data: { locale, key },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
  },
})

export default i18n
