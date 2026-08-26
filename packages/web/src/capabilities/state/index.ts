import { createPinia, type Pinia, type StoreGeneric } from 'pinia'
import piniaPersistPlugin from './pinia-persist.js'

/** Creates OdbVue's Pinia runtime with persistence support. */
export function createOdbVuePinia(): Pinia {
  const instance = createPinia()
  instance.use(piniaPersistPlugin)
  return instance
}

/** Returns the stores currently registered with an OdbVue Pinia runtime. */
export function getOdbVueStores(pinia: Pinia): StoreGeneric[] {
  return [...pinia._s.values()]
}

export { getPersistOptions } from './pinia-persist.js'
export type { PersistCookieOptions, PersistOptions, PersistStorage } from './pinia-persist.js'
