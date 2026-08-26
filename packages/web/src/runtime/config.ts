import type { OdbVueAppConfig, OdbVueCapabilityName } from './app-config.js'
import { useOdbVue } from './context.js'

/** Returns the configuration installed when the OdbVue application was created. */
export function useOdbVueConfig(): OdbVueAppConfig {
  return useOdbVue().config
}

/** Returns an enabled capability's configuration, or undefined when it is disabled. */
export function useCapability<Name extends OdbVueCapabilityName>(
  name: Name,
): OdbVueAppConfig[Name] | undefined {
  const capability = useOdbVueConfig()[name]
  return capability === false || capability === undefined ? undefined : capability
}
