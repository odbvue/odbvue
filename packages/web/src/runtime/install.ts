import { createHead } from '@unhead/vue/client'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { OdbVueAppConfig } from './config.js'
import { errorsCapability } from '../capabilities/errors/index.js'
import { httpCapability } from '../capabilities/http/index.js'
import { i18nCapability } from '../capabilities/i18n/index.js'
import { stateCapability } from '../capabilities/state/index.js'
import { uiCapability } from '../capabilities/ui/index.js'
import { resolveOdbVueCapabilities, type OdbVueCapability } from './capability.js'
import { odbVueRuntimeKey } from './context.js'
import { createOdbVueHooks } from './hooks.js'
import type { OdbVueRuntime } from './types.js'

const coreCapabilities: readonly OdbVueCapability[] = [
  errorsCapability,
  stateCapability,
  httpCapability,
  i18nCapability,
  uiCapability,
]

/** Installs OdbVue's configured runtime into a Vue application. */
export function installOdbVue(app: App, config: OdbVueAppConfig, router?: Router): OdbVueRuntime {
  const services = new Map<symbol, unknown>()
  const runtime: OdbVueRuntime = {
    config,
    hooks: createOdbVueHooks(config.hooks),
    provide(contract, value) {
      if (services.has(contract.key))
        throw new Error('An OdbVue contract can only be provided once.')
      services.set(contract.key, value)
    },
    get(contract) {
      if (!services.has(contract.key))
        throw new Error('The requested OdbVue contract is not available.')
      return services.get(
        contract.key,
      ) as typeof contract extends import('./contract.js').OdbVueContract<infer Value>
        ? Value
        : never
    },
  }

  const capabilities = resolveOdbVueCapabilities(coreCapabilities)
  for (const capability of capabilities) capability.setup?.({ ...runtime, app })
  app.provide(odbVueRuntimeKey, runtime)
  if (router) app.use(router)
  app.use(createHead())
  for (const capability of capabilities) void capability.start?.(runtime)
  void runtime.hooks.emit('app:started', undefined)

  return runtime
}
