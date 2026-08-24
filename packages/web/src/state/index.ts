import { createPinia, type Pinia } from 'pinia'
import piniaPersistPlugin from './pinia-persist.js'

let pinia: Pinia | undefined

/** Creates OdbVue's Pinia runtime with persistence support. */
export function createOdbVuePinia(): Pinia {
  const instance = createPinia()
  instance.use(piniaPersistPlugin)
  return instance
}

export function setOdbVuePinia(instance: Pinia): void {
  pinia = instance
}

/** Returns the Pinia runtime installed with the OdbVue application. */
export function getOdbVuePinia(): Pinia {
  if (!pinia) {
    throw new Error('OdbVue Pinia is not installed. Call installOdbVueConfig() before using it.')
  }
  return pinia
}

export type { PersistCookieOptions, PersistOptions, PersistStorage } from './pinia-persist.js'