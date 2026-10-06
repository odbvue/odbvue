import { describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  defineOdbVueApp,
  installOdbVue,
  createOdbVueErrors,
  resolveOdbVueLocale,
  useAppStore,
  authContract,
  authCapability,
  useOdbVue,
  useOdbVueConfig,
  errorsContract,
  httpContract,
  stateContract,
  uiContract,
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
    const config = defineOdbVueApp({ auth: { endpoints: { login: '/session/login' } } })

    expect(config).toEqual({ auth: { endpoints: { login: '/session/login' } } })
  })

  it('provides config and services without capability flags', () => {
    const config = defineOdbVueApp({
      ui: { theme: { default: 'dark' } },
    })
    let providedConfig: unknown
    let providedRuntime: unknown

    const app = createApp({})
    const runtime = installOdbVue(app, config)
    app.runWithContext(() => {
      providedRuntime = useOdbVue()
      providedConfig = useOdbVueConfig()
    })

    expect(providedRuntime).toBe(runtime)
    expect(providedConfig).toBe(config)
    expect(runtime.get(authContract)).toBeDefined()
    expect(runtime.get(httpContract)).toBeDefined()
    expect(runtime.get(uiContract).theme.name.value).toBe('dark')
    expect(runtime.get(errorsContract)).toBeDefined()
  })

  it('creates independent runtimes for independent applications', () => {
    const config1 = defineOdbVueApp({ title: 'First' })
    const config2 = defineOdbVueApp({ title: 'Second' })

    const runtime1 = installOdbVue(createApp({}), config1)
    const runtime2 = installOdbVue(createApp({}), config2)

    expect(runtime1).not.toBe(runtime2)
    expect(runtime1.get(stateContract)).not.toBe(runtime2.get(stateContract))
    expect(runtime1.get(httpContract)).not.toBe(runtime2.get(httpContract))
    expect(runtime1.config).toBe(config1)
    expect(runtime2.config).toBe(config2)
  })

  it('restores auth at startup without an enablement flag', async () => {
    const runtime = installOdbVue(createApp({}), defineOdbVueApp({}))
    const auth = runtime.get(authContract)
    const restore = vi.spyOn(auth, 'restore').mockResolvedValue(false)

    await authCapability.start?.(runtime)

    expect(restore).toHaveBeenCalledOnce()
    restore.mockRestore()
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
