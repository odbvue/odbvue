import { describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  defineOdbVueApp,
  installOdbVue,
  createOdbVueErrors,
  resolveOdbVueLocale,
  useAppStore,
  useCapability,
  useOdbVue,
  useOdbVueConfig,
} from '../src/index.js'

describe('OdbVue application config', () => {
  it('captures normalized errors and isolates reporter failures', async () => {
    const reporter = vi.fn<() => void>(() => {
      throw new Error('Reporter unavailable')
    })
    const errors = createOdbVueErrors({ bufferSize: 1, reporters: [reporter] })

    const event = errors.capture(new Error('Save failed'), { source: 'orders' })
    errors.capture('Second error')
    await Promise.resolve()

    expect(event.message).toBe('Save failed')
    expect(event.name).toBe('Error')
    expect(event.source).toBe('orders')
    expect(errors.getEvents()).toHaveLength(1)
    expect(errors.getEvents()[0]?.message).toBe('Second error')
    expect(reporter).toHaveBeenCalledTimes(2)
  })

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
    let providedRuntime: unknown
    let auth: unknown
    let audit: unknown

    const app = createApp({})
    const runtime = installOdbVue(app, config)
    app.runWithContext(() => {
      providedRuntime = useOdbVue()
      providedConfig = useOdbVueConfig()
      auth = useCapability('auth')
      audit = useCapability('audit')
    })

    expect(providedRuntime).toBe(runtime)
    expect(providedConfig).toBe(config)
    expect(auth).toEqual({ local: true })
    expect(audit).toBeUndefined()
    expect(runtime.vuetify.theme.name.value).toBe('dark')
    expect(runtime.errors).toBeDefined()
  })

  it('creates independent runtimes for independent applications', () => {
    const config1 = defineOdbVueApp({ title: 'First' })
    const config2 = defineOdbVueApp({ title: 'Second' })

    const runtime1 = installOdbVue(createApp({}), config1)
    const runtime2 = installOdbVue(createApp({}), config2)

    expect(runtime1).not.toBe(runtime2)
    expect(runtime1.pinia).not.toBe(runtime2.pinia)
    expect(runtime1.config).toBe(config1)
    expect(runtime2.config).toBe(config2)
  })

  it('throws when OdbVue has not been installed on the application', () => {
    const app = createApp({})

    expect(() => app.runWithContext(() => useOdbVue())).toThrow(
      'OdbVue runtime is not available. Has OdbVue been installed on this Vue app?',
    )
  })

  it('installs the application router', () => {
    const app = createApp({})
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })

    installOdbVue(app, defineOdbVueApp({}), router)

    expect(app.config.globalProperties.$router).toBe(router)
  })

  it('provides app metadata to the framework store', () => {
    const app = createApp({})
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })

    installOdbVue(app, defineOdbVueApp({ title: 'Example', version: '2.0.0' }), router)

    app.runWithContext(() => {
      expect(useAppStore().title).toBe('Example')
      expect(useAppStore().version).toBe('2.0.0')
    })
  })

  it('matches the browser language to a configured locale', () => {
    expect(resolveOdbVueLocale(['en', 'fr', 'de'], 'en', ['de-AT', 'fr'])).toBe('de')
    expect(resolveOdbVueLocale(['en', 'fr', 'de'], 'en', ['es-MX'])).toBe('en')
  })
})
