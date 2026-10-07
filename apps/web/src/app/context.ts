import { inject, type InjectionKey } from 'vue'
import type { Pinia } from 'pinia'
import type { createOdbVueAuth } from './auth'
import type { OdbVueAppConfig } from './config'
import type { OdbVueErrors } from './errors'
import type { OdbVueHooks } from './events'
import type { HttpClient } from './http'
import type { createOdbVueI18n } from './i18n'
import type { createOdbVueVuetify } from './ui'

export interface AppServices {
  config: OdbVueAppConfig
  auth: ReturnType<typeof createOdbVueAuth>
  http: HttpClient
  errors: OdbVueErrors
  hooks: OdbVueHooks
  pinia: Pinia
  i18n: ReturnType<typeof createOdbVueI18n>
  vuetify: ReturnType<typeof createOdbVueVuetify>
  ready: Promise<void>
}

export const appServicesKey: InjectionKey<AppServices> = Symbol('app-services')

export function useAppServices(): AppServices {
  const services = inject(appServicesKey)
  if (!services)
    throw new Error('Application services are not available. Install app plugins first.')
  return services
}
