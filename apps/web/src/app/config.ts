import type { IconAliases, ThemeDefinition, VuetifyOptions } from 'vuetify'
import type { I18nOptions } from 'vue-i18n'
import type { HttpConfiguration } from './http/index.js'
import { useAppServices } from './context'
import type { OdbVueHookHandlers } from './events.js'

export type OdbVueAuthConfig = {
  endpoints?: Partial<import('./auth/index.js').OdbVueAuthEndpoints>
  routes?: {
    login?: string
    authenticated?: string
    forbidden?: string
  }
}
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

export type OdbVueErrorsConfig = import('./errors/index.js').OdbVueErrorsConfig

export type OdbVueAppConfig = {
  title?: string
  version?: string
  auth?: OdbVueAuthConfig
  ui?: OdbVueUiConfig
  i18n?: OdbVueI18nConfig
  errors?: OdbVueErrorsConfig
  http?: HttpConfiguration
  integrations?: Record<string, unknown>
  hooks?: OdbVueHookHandlers
  modules?: string[]
}

/** Defines an OdbVue application configuration with inferred literal types. */
export function defineAppConfig<const Config extends OdbVueAppConfig>(config: Config): Config {
  return config
}

/** Returns the configuration installed when the OdbVue application was created. */
export function useAppConfig(): OdbVueAppConfig {
  return useAppServices().config
}
