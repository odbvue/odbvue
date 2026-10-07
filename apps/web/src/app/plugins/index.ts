import { createHead } from '@unhead/vue/client'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import { createOdbVueAuth } from '../auth'
import type { OdbVueAppConfig } from '../config'
import { appServicesKey, type AppServices } from '../context'
import { createOdbVueErrors } from '../errors'
import { createOdbVueHooks } from '../events'
import { createOdbVueHttp } from '../http'
import { createOdbVueI18n } from '../i18n'
import { createOdbVuePinia } from '../state'
import { createOdbVueVuetify } from '../ui'

export function installApp(app: App, config: OdbVueAppConfig, router?: Router): AppServices {
  const hooks = createOdbVueHooks(config.hooks)
  const errors = createOdbVueErrors(config.errors, hooks)
  const auth = createOdbVueAuth({ endpoints: config.auth?.endpoints })
  const http = createOdbVueHttp(
    {
      ...config.http,
      getAccessToken: () => auth.accessToken.value,
      refreshAccessToken: () => auth.refresh(),
    },
    hooks,
  )
  auth.setHttp(http)
  const pinia = createOdbVuePinia()
  const i18n = createOdbVueI18n(config.i18n)
  const vuetify = createOdbVueVuetify(config.ui)
  const ready = Promise.resolve().then(async () => {
    await auth.restore()
    await hooks.emit('app:started', undefined)
  })
  const services: AppServices = { config, auth, http, errors, hooks, pinia, i18n, vuetify, ready }

  app.provide(appServicesKey, services)
  app.config.errorHandler = (error, instance, info) => {
    errors.capture(error, { source: 'vue', context: { component: instance?.$options.name, info } })
  }
  app.use(pinia)
  app.use(i18n)
  app.use(vuetify)
  app.use(createHead())
  if (router) app.use(router)
  void ready.catch((error: unknown) => {
    errors.capture(error, { source: 'app', operation: 'startup' })
  })
  return services
}
