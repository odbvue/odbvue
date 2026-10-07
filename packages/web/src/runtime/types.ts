import type { OdbVueAppConfig } from './config.js'
import type { OdbVueContract } from './contract.js'
import type { OdbVueHooks } from './hooks.js'

export interface OdbVueRuntime {
  config: OdbVueAppConfig
  hooks: OdbVueHooks
  readonly ready: Promise<void>
  provide<T>(contract: OdbVueContract<T>, value: T): void
  get<T>(contract: OdbVueContract<T>): T
}
