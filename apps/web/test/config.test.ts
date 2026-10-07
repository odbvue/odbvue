import { describe, expect, it, vi } from 'vitest'
import { appConfig, useAppConfig } from '@/app/config'
import { createErrors } from '@/app/errors'
import { resolveLocale } from '@/app/i18n'

describe('application config and errors', () => {
  it('captures normalized errors and isolates reporter failures', async () => {
    const reporter = vi.fn<() => void>(() => {
      throw new Error('Reporter unavailable')
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const errors = createErrors({ bufferSize: 1, reporters: [reporter] })
      const event = errors.capture(new Error('Save failed'), { source: 'orders' })
      errors.capture('Second error')
      await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(2))

      expect(event).toMatchObject({ message: 'Save failed', name: 'Error', source: 'orders' })
      expect(errors.getEvents()).toEqual([expect.objectContaining({ message: 'Second error' })])
      expect(reporter).toHaveBeenCalledTimes(2)
    } finally {
      log.mockRestore()
    }
  })

  it('exposes application metadata without an injection context', () => {
    expect(useAppConfig()).toBe(appConfig)
    expect(appConfig).toMatchObject({ title: 'OdbVue', version: '1.0.0' })
  })

  it('matches the browser language to a configured locale', () => {
    expect(resolveLocale(['en', 'fr', 'de'], 'en', ['de-AT', 'fr'])).toBe('de')
    expect(resolveLocale(['en', 'fr', 'de'], 'en', ['es-MX'])).toBe('en')
  })
})
