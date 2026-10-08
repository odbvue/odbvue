import type { IconAliases, ThemeDefinition, VuetifyOptions } from 'vuetify'
import type { I18nOptions } from 'vue-i18n'
import type { HttpConfiguration } from './http/index.js'
import config from '../../odbvue.config'

export type AuthConfig = {
  endpoints?: Partial<import('./auth/index.js').AuthEndpoints>
  routes?: {
    login?: string
    authenticated?: string
    forbidden?: string
  }
}
export type UiConfig = {
  theme?: {
    default?: string
    light?: ThemeDefinition
    dark?: ThemeDefinition
  }
  defaults?: VuetifyOptions['defaults']
  icons?: Partial<IconAliases>
  vuetify?: Omit<VuetifyOptions, 'blueprint' | 'defaults' | 'icons' | 'theme'>
}

export type I18nConfig = {
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

export type ErrorsConfig = import('./errors/index.js').ErrorsConfig

export type AppConfig = {
  title?: string
  version?: string
  auth?: AuthConfig
  ui?: UiConfig
  i18n?: I18nConfig
  errors?: ErrorsConfig
  http?: HttpConfiguration
}

export const appConfig: AppConfig = config
