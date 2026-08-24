import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import {
  defineOdbVueApp,
  installOdbVueConfig,
  useCapability,
  useOdbVueConfig,
} from '../src/index.js'

describe('OdbVue application config', () => {
  it('preserves the declared configuration', () => {
    const config = defineOdbVueApp({ auth: { local: true }, audit: true })

    expect(config).toEqual({ auth: { local: true }, audit: true })
  })

  it('provides config and enabled capabilities to composables', () => {
    const config = defineOdbVueApp({ auth: { local: true }, audit: false })
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
  })
})