import { inject, type InjectionKey } from 'vue'
import type { OdbVueAppConfig, OdbVueCapabilityName } from '../config/index.js'

export const odbVueConfigKey: InjectionKey<OdbVueAppConfig> = Symbol('odbvue-config')

let installedConfig: OdbVueAppConfig | undefined

export function setOdbVueConfig(config: OdbVueAppConfig): void {
  installedConfig = config
}

/** Returns the configuration installed when the OdbVue application was created. */
export function getOdbVueConfig(): OdbVueAppConfig {
  if (!installedConfig) {
    throw new Error('OdbVue config is not installed. Call installOdbVue() before using it.')
  }
  return installedConfig
}

/** Returns the configuration installed when the OdbVue application was created. */
export function useOdbVueConfig(): OdbVueAppConfig {
  return inject(odbVueConfigKey) ?? getOdbVueConfig()
}

/** Returns an enabled capability's configuration, or undefined when it is disabled. */
export function useCapability<Name extends OdbVueCapabilityName>(
  name: Name,
): OdbVueAppConfig[Name] | undefined {
  const capability = useOdbVueConfig()[name]
  return capability === false || capability === undefined ? undefined : capability
}
