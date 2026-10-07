import { createPinia, type Pinia, type StoreGeneric } from 'pinia'
import piniaPersistPlugin from './pinia-persist.js'

const storeRegistries = new WeakMap<Pinia, Map<string, StoreGeneric>>()

/** Creates OdbVue's Pinia runtime with persistence support. */
export function createOdbVuePinia(): Pinia {
  const instance = createPinia()
  const stores = new Map<string, StoreGeneric>()
  storeRegistries.set(instance, stores)
  instance.use(({ store }) => {
    stores.set(store.$id, store)
  })
  instance.use(piniaPersistPlugin)
  return instance
}

/** Returns the stores currently registered with an OdbVue Pinia runtime. */
export function getOdbVueStores(pinia: Pinia): StoreGeneric[] {
  return [...(storeRegistries.get(pinia)?.values() ?? [])]
}

export { getPersistOptions } from './pinia-persist.js'
export type { PersistCookieOptions, PersistOptions, PersistStorage } from './pinia-persist.js'
