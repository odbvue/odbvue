import { createI18n } from 'vue-i18n'
import messages from '@intlify/unplugin-vue-i18n/messages'
import type { OdbVueI18nConfig } from '../config/index.js'

type OdbVueI18n = ReturnType<typeof createI18n>

const defaultLocales = ['en', 'fr', 'de'] as const

let i18n: OdbVueI18n | undefined

/** Creates OdbVue's Vue I18n runtime from stable application i18n settings. */
export function createOdbVueI18n(config: OdbVueI18nConfig = {}): OdbVueI18n {
  const pendingKeys = new Set<string>()
  const locales = config.locales ?? defaultLocales
  const fallbackLocale = config.fallbackLocale ?? 'en'

  return createI18n({
    ...config.options,
    legacy: false,
    globalInjection: true,
    locale:
      config.locale ??
      (config.detectBrowserLocale === false
        ? fallbackLocale
        : resolveOdbVueLocale(locales, fallbackLocale)),
    fallbackLocale,
    messages,
    missing: (locale: string, key: string) => {
      if (
        !(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV ||
        typeof window === 'undefined'
      )
        return

      const cacheKey = `${locale}:${key}`
      if (pendingKeys.has(cacheKey)) return
      pendingKeys.add(cacheKey)

      fetch('/i18n-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { locale, key, value: key } }),
      }).finally(() => pendingKeys.delete(cacheKey))
    },
  })
}

export function setOdbVueI18n(instance: OdbVueI18n): void {
  i18n = instance
}

/** Selects the first configured locale matching the browser's language preferences. */
export function resolveOdbVueLocale(
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

/** Returns the Vue I18n runtime installed with the OdbVue application. */
export function getOdbVueI18n(): OdbVueI18n {
  if (!i18n) {
    throw new Error('OdbVue i18n is not installed. Call installOdbVue() before using it.')
  }
  return i18n
}
