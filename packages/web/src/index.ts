import { inject, type App, type InjectionKey } from 'vue'
import 'vuetify/styles'
import { createI18n, type I18nOptions } from 'vue-i18n'
import messages from '@intlify/unplugin-vue-i18n/messages'
import { createVuetify, type IconAliases, type ThemeDefinition, type VuetifyOptions } from 'vuetify'
import { md3 } from 'vuetify/blueprints'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export type OdbVueAuthConfig = boolean | Record<string, unknown>
export type OdbVueProviderConfig = boolean | { provider: string; [key: string]: unknown }
export type OdbVueHook = (...args: unknown[]) => unknown | Promise<unknown>

export type OdbVueUiConfig = {
  theme?: {
    default?: string
    light?: ThemeDefinition
    dark?: ThemeDefinition
  }
  defaults?: VuetifyOptions['defaults']
  icons?: Partial<IconAliases>
  vuetify?: Omit<VuetifyOptions, 'blueprint' | 'defaults' | 'icons' | 'theme'>
}

export type OdbVueI18nConfig = {
  /** Locales compiled into the application and eligible for browser-language matching. */
  locales?: readonly string[]
  /** Explicit initial locale. Takes precedence over browser-language detection. */
  locale?: string
  fallbackLocale?: string
  detectBrowserLocale?: boolean
  options?: Omit<
    I18nOptions,
    'legacy' | 'globalInjection' | 'locale' | 'fallbackLocale' | 'messages' | 'missing'
  >
}

export type OdbVueAppConfig = {
  title?: string
  version?: string
  auth?: OdbVueAuthConfig
  audit?: boolean
  settings?: boolean
  storage?: OdbVueProviderConfig
  ai?: OdbVueProviderConfig
  email?: OdbVueProviderConfig
  ui?: OdbVueUiConfig
  i18n?: OdbVueI18nConfig
  integrations?: Record<string, unknown>
  hooks?: Record<string, OdbVueHook | OdbVueHook[]>
  modules?: string[]
  preset?: string
}

export type OdbVueCapabilityName = 'auth' | 'audit' | 'settings' | 'storage' | 'ai' | 'email'

export const odbVueConfigKey: InjectionKey<OdbVueAppConfig> = Symbol('odbvue-config')

type OdbVueVuetify = ReturnType<typeof createVuetify>
type OdbVueI18n = ReturnType<typeof createI18n>

const defaultLocales = ['en', 'fr', 'de'] as const

let vuetify: OdbVueVuetify | undefined
let i18n: OdbVueI18n | undefined

/** Defines an OdbVue application configuration with inferred literal types. */
export function defineOdbVueApp<const Config extends OdbVueAppConfig>(config: Config): Config {
  return config
}

/** Makes an OdbVue application configuration available to Vue composables. */
export function installOdbVueConfig(app: App, config: OdbVueAppConfig): void {
  app.provide(odbVueConfigKey, config)
  vuetify = createOdbVueVuetify(config.ui)
  app.use(vuetify)
  i18n = createOdbVueI18n(config.i18n)
  app.use(i18n)
}

/** Creates OdbVue's Vuetify runtime from stable application UI settings. */
export function createOdbVueVuetify(ui: OdbVueUiConfig = {}): OdbVueVuetify {
  return createVuetify({
    ...ui.vuetify,
    blueprint: md3,
    theme: {
      defaultTheme: ui.theme?.default ?? 'system',
      themes: {
        ...(ui.theme?.light ? { light: ui.theme.light } : {}),
        ...(ui.theme?.dark ? { dark: ui.theme.dark } : {}),
      },
    },
    defaults: ui.defaults,
    icons: {
      defaultSet: 'mdi',
      aliases: { ...aliases, ...ui.icons },
      sets: { mdi },
    },
  })
}

/** Returns the Vuetify runtime installed with the OdbVue application. */
export function getOdbVueVuetify(): OdbVueVuetify {
  if (!vuetify) {
    throw new Error('OdbVue UI is not installed. Call installOdbVueConfig() before using it.')
  }
  return vuetify
}

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
    throw new Error('OdbVue i18n is not installed. Call installOdbVueConfig() before using it.')
  }
  return i18n
}

/** Returns the configuration installed when the OdbVue application was created. */
export function useOdbVueConfig(): OdbVueAppConfig {
  const config = inject(odbVueConfigKey)
  if (!config) {
    throw new Error(
      'OdbVue config is not installed. Call installOdbVueConfig() before mounting the app.',
    )
  }
  return config
}

/** Returns an enabled capability's configuration, or undefined when it is disabled. */
export function useCapability<Name extends OdbVueCapabilityName>(
  name: Name,
): OdbVueAppConfig[Name] | undefined {
  const capability = useOdbVueConfig()[name]
  return capability === false || capability === undefined ? undefined : capability
}
