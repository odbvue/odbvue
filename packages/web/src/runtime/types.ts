import type { Pinia } from 'pinia'
import { createVuetify } from 'vuetify'
import type { OdbVueAppConfig } from './config.js'
import type { createOdbVueI18n } from '../capabilities/i18n/index.js'

type OdbVueVuetify = ReturnType<typeof createVuetify>
type OdbVueI18n = ReturnType<typeof createOdbVueI18n>

export interface OdbVueRuntime {
  config: OdbVueAppConfig
  pinia: Pinia
  vuetify: OdbVueVuetify
  i18n: OdbVueI18n
}
