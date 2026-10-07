import { createPinia, type Pinia } from 'pinia'
import piniaPersistPlugin from './pinia-persist.js'

/** Creates OdbVue's Pinia runtime with persistence support. */
export function createState(): Pinia {
  const instance = createPinia()
  instance.use(piniaPersistPlugin)
  return instance
}

export const pinia = createState()

export type { PersistCookieOptions, PersistOptions, PersistStorage } from './pinia-persist.js'
