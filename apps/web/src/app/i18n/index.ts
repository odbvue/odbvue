import { createI18n } from 'vue-i18n'
import messages from '@intlify/unplugin-vue-i18n/messages'
import { appConfig } from '../config.js'

const defaultLocales = ['en', 'fr', 'de'] as const

const config = appConfig.i18n ?? {}
const pendingKeys = new Set<string>()
const configuredLocales = config.locales ?? defaultLocales
const configuredFallbackLocale = config.fallbackLocale ?? 'en'

export const i18n = createI18n({
  ...config.options,
  legacy: false,
  globalInjection: true,
  locale:
    config.locale ??
    (config.detectBrowserLocale === false
      ? configuredFallbackLocale
      : resolveLocale(configuredLocales, configuredFallbackLocale)),
  fallbackLocale: configuredFallbackLocale,
  messages,
  missing: (locale: string, key: string) => {
    if (!import.meta.env.DEV || import.meta.env.MODE === 'test' || typeof window === 'undefined')
      return

    const cacheKey = `${locale}:${key}`
    if (pendingKeys.has(cacheKey)) return
    pendingKeys.add(cacheKey)

    fetch('/i18n-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { locale, key, value: key } }),
    })
      .catch((error: unknown) => console.warn('Unable to collect missing translation', error))
      .finally(() => pendingKeys.delete(cacheKey))
  },
})

/** Selects the first configured locale matching the browser's language preferences. */
export function resolveLocale(
  locales: readonly string[] = defaultLocales,
  fallbackLocale = 'en',
  browserLanguages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages,
): string {
  for (const language of browserLanguages) {
    const normalizedLanguage = language.toLowerCase()
    const match =
      locales.find((locale) => locale.toLowerCase() === normalizedLanguage) ??
      locales.find((locale) => locale.toLowerCase() === normalizedLanguage.split('-')[0])
    if (match) return match
  }

  return locales.includes(fallbackLocale) ? fallbackLocale : (locales[0] ?? fallbackLocale)
}
