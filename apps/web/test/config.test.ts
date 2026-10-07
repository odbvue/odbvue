import { describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineAppConfig, useAppConfig } from '@/app/config'
import { installApp } from '@/app/plugins'
import { createOdbVueErrors } from '@/app/errors'
import { resolveOdbVueLocale } from '@/app/i18n'
import { useAppServices } from '@/app/context'

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
    const config = defineAppConfig({ auth: { endpoints: { login: '/session/login' } } })

    expect(config).toEqual({ auth: { endpoints: { login: '/session/login' } } })
  })

  it('provides config and services without capability flags', () => {
    const config = defineAppConfig({
      ui: { theme: { default: 'dark' } },
    })
    let providedConfig: unknown
    let providedRuntime: unknown

    const app = createApp({})
    const runtime = installApp(app, config)
    app.runWithContext(() => {
      providedRuntime = useAppServices()
      providedConfig = useAppConfig()
    })

    expect(providedRuntime).toBe(runtime)
    expect(providedConfig).toBe(config)
    expect(runtime.auth).toBeDefined()
    expect(runtime.http).toBeDefined()
    expect(runtime.vuetify.theme.name.value).toBe('dark')
    expect(runtime.errors).toBeDefined()
  })

  it('creates independent services for independent applications', () => {
    const config1 = defineAppConfig({ title: 'First' })
    const config2 = defineAppConfig({ title: 'Second' })

    const runtime1 = installApp(createApp({}), config1)
    const runtime2 = installApp(createApp({}), config2)

    expect(runtime1).not.toBe(runtime2)
    expect(runtime1.pinia).not.toBe(runtime2.pinia)
    expect(runtime1.http).not.toBe(runtime2.http)
    expect(runtime1.config).toBe(config1)
    expect(runtime2.config).toBe(config2)
  })

  it('restores auth at startup without an enablement flag', async () => {
    const runtime = installApp(createApp({}), defineAppConfig({}))
    const auth = runtime.auth
    const restore = vi.spyOn(auth, 'restore').mockResolvedValue(false)

    await runtime.ready

    expect(restore).toHaveBeenCalledOnce()
    restore.mockRestore()
  })

  it('throws when OdbVue has not been installed on the application', () => {
    const app = createApp({})

    expect(() => app.runWithContext(() => useAppServices())).toThrow(
      'Application services are not available. Install app plugins first.',
    )
  })

  it('installs the application router', () => {
    const app = createApp({})
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })

    installApp(app, defineAppConfig({}), router)

    expect(app.config.globalProperties.$router).toBe(router)
  })

  it('provides app metadata without an aggregator store', () => {
    const app = createApp({})
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })

    installApp(app, defineAppConfig({ title: 'Example', version: '2.0.0' }), router)

    app.runWithContext(() => {
      expect(useAppConfig().title).toBe('Example')
      expect(useAppConfig().version).toBe('2.0.0')
    })
  })

  it('matches the browser language to a configured locale', () => {
    expect(resolveOdbVueLocale(['en', 'fr', 'de'], 'en', ['de-AT', 'fr'])).toBe('de')
    expect(resolveOdbVueLocale(['en', 'fr', 'de'], 'en', ['es-MX'])).toBe('en')
  })
})
