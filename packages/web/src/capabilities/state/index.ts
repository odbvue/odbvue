import { createPinia, type Pinia } from 'pinia'
import piniaPersistPlugin from './pinia-persist.js'

/** Creates OdbVue's Pinia runtime with persistence support. */
export function createOdbVuePinia(): Pinia {
  const instance = createPinia()
  instance.use(piniaPersistPlugin)
  return instance
}

export { getPersistOptions } from './pinia-persist.js'
export type { PersistCookieOptions, PersistOptions, PersistStorage } from './pinia-persist.js'
