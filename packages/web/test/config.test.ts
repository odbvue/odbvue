import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  defineOdbVueApp,
  getOdbVueVuetify,
  installOdbVueConfig,
  resolveOdbVueLocale,
  useCapability,
  useOdbVueConfig,
} from '../src/index.js'

describe('OdbVue application config', () => {
  it('preserves the declared configuration', () => {
    const config = defineOdbVueApp({ auth: { local: true }, audit: true })

    expect(config).toEqual({ auth: { local: true }, audit: true })
  })

  it('provides config and enabled capabilities to composables', () => {
    const config = defineOdbVueApp({
      auth: { local: true },
      audit: false,
      ui: { theme: { default: 'dark' } },
    })
    let providedConfig: unknown
    let auth: unknown
    let audit: unknown

    const app = createApp({})
    installOdbVueConfig(app, config)
    app.runWithContext(() => {
      providedConfig = useOdbVueConfig()
      auth = useCapability('auth')
      audit = useCapability('audit')
    })

    expect(providedConfig).toBe(config)
    expect(auth).toEqual({ local: true })
    expect(audit).toBeUndefined()
    expect(getOdbVueVuetify().theme.name.value).toBe('dark')
  })

  it('installs the application router', () => {
    const app = createApp({})
    const router = createRouter({ history: createMemoryHistory(), routes: [] })

    installOdbVueConfig(app, defineOdbVueApp({}), router)

    expect(app.config.globalProperties.$router).toBe(router)
  })

  it('matches the browser language to a configured locale', () => {
    expect(resolveOdbVueLocale(['en', 'fr', 'de'], 'en', ['de-AT', 'fr'])).toBe('de')
    expect(resolveOdbVueLocale(['en', 'fr', 'de'], 'en', ['es-MX'])).toBe('en')
  })
})
