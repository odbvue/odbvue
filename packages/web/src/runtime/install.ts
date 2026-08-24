import { createHead } from '@unhead/vue/client'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { OdbVueAppConfig } from '../config/index.js'
import { configureOdbVueHttp } from '../http/index.js'
import { createOdbVueI18n } from '../i18n/index.js'
import { createOdbVuePinia } from '../state/index.js'
import { createOdbVueVuetify } from '../ui/index.js'
import { odbVueRuntimeKey } from './context.js'
import type { OdbVueRuntime } from './types.js'

/** Installs OdbVue's configured runtime into a Vue application. */
export function installOdbVue(app: App, config: OdbVueAppConfig, router?: Router): OdbVueRuntime {
  const pinia = createOdbVuePinia()
  const vuetify = createOdbVueVuetify(config.ui)
  const i18n = createOdbVueI18n(config.i18n)

  const runtime: OdbVueRuntime = { config, pinia, vuetify, i18n }

  app.use(pinia)
  configureOdbVueHttp()
  app.use(vuetify)
  app.use(i18n)
  app.provide(odbVueRuntimeKey, runtime)
  if (router) app.use(router)
  app.use(createHead())

  return runtime
}
