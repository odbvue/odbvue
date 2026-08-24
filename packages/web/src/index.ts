import { inject, type App, type InjectionKey } from 'vue'
import 'vuetify/styles'
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
  integrations?: Record<string, unknown>
  hooks?: Record<string, OdbVueHook | OdbVueHook[]>
  modules?: string[]
  preset?: string
}

export type OdbVueCapabilityName = 'auth' | 'audit' | 'settings' | 'storage' | 'ai' | 'email'

export const odbVueConfigKey: InjectionKey<OdbVueAppConfig> = Symbol('odbvue-config')

type OdbVueVuetify = ReturnType<typeof createVuetify>

let vuetify: OdbVueVuetify | undefined

/** Defines an OdbVue application configuration with inferred literal types. */
export function defineOdbVueApp<const Config extends OdbVueAppConfig>(config: Config): Config {
  return config
}

/** Makes an OdbVue application configuration available to Vue composables. */
export function installOdbVueConfig(app: App, config: OdbVueAppConfig): void {
  app.provide(odbVueConfigKey, config)
  vuetify = createOdbVueVuetify(config.ui)
  app.use(vuetify)
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
