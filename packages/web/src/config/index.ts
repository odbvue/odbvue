import type { IconAliases, ThemeDefinition, VuetifyOptions } from 'vuetify'
import type { I18nOptions } from 'vue-i18n'

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

/** Defines an OdbVue application configuration with inferred literal types. */
export function defineOdbVueApp<const Config extends OdbVueAppConfig>(config: Config): Config {
  return config
}
