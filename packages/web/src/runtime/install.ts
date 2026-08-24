import { createHead } from '@unhead/vue/client'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { OdbVueAppConfig } from '../config/index.js'
import { configureOdbVueHttp } from '../http/index.js'
import { createOdbVueI18n, setOdbVueI18n } from '../i18n/index.js'
import { createOdbVuePinia, setOdbVuePinia } from '../state/index.js'
import { createOdbVueVuetify, setOdbVueVuetify } from '../ui/index.js'
import { odbVueConfigKey, setOdbVueConfig } from './config.js'

/** Installs OdbVue's configured runtime into a Vue application. */
export function installOdbVue(app: App, config: OdbVueAppConfig, router?: Router): void {
  setOdbVueConfig(config)
  app.provide(odbVueConfigKey, config)

  const pinia = createOdbVuePinia()
  setOdbVuePinia(pinia)
  app.use(pinia)

  configureOdbVueHttp()

  const vuetify = createOdbVueVuetify(config.ui)
  setOdbVueVuetify(vuetify)
  app.use(vuetify)

  const i18n = createOdbVueI18n(config.i18n)
  setOdbVueI18n(i18n)
  app.use(i18n)
  if (router) app.use(router)
  app.use(createHead())
}
