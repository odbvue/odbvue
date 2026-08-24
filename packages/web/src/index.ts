import { inject, type App, type InjectionKey } from 'vue'

export type OdbVueAuthConfig = boolean | Record<string, unknown>
export type OdbVueProviderConfig = boolean | { provider: string; [key: string]: unknown }
export type OdbVueHook = (...args: unknown[]) => unknown | Promise<unknown>

export type OdbVueAppConfig = {
  title?: string
  version?: string
  auth?: OdbVueAuthConfig
  audit?: boolean
  settings?: boolean
  storage?: OdbVueProviderConfig
  ai?: OdbVueProviderConfig
  email?: OdbVueProviderConfig
  integrations?: Record<string, unknown>
  hooks?: Record<string, OdbVueHook | OdbVueHook[]>
  modules?: string[]
  preset?: string
}

export type OdbVueCapabilityName = 'auth' | 'audit' | 'settings' | 'storage' | 'ai' | 'email'

export const odbVueConfigKey: InjectionKey<OdbVueAppConfig> = Symbol('odbvue-config')

/** Defines an OdbVue application configuration with inferred literal types. */
export function defineOdbVueApp<const Config extends OdbVueAppConfig>(config: Config): Config {
  return config
}

/** Makes an OdbVue application configuration available to Vue composables. */
export function installOdbVueConfig(app: App, config: OdbVueAppConfig): void {
  app.provide(odbVueConfigKey, config)
}

/** Returns the configuration installed when the OdbVue application was created. */
export function useOdbVueConfig(): OdbVueAppConfig {
  const config = inject(odbVueConfigKey)
  if (!config) {
    throw new Error('OdbVue config is not installed. Call installOdbVueConfig() before mounting the app.')
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