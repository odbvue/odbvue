import { beforeAll, describe, expect, it, vi } from 'vitest'
import { isReadonly } from 'vue'
import { createState } from '@/capabilities/state'
import { createLoading } from '@/capabilities/ui/loading'
import { useUi } from '@/capabilities/ui/store'
import { mutationError } from '@/capabilities/ui/mutation-error'
import { i18n } from '@/capabilities/i18n'
import { createHttpClient } from '@/capabilities/http/core'
import appMessages from '@/app/i18n/en.json'
import adminMessages from '@/modules/admin/i18n/en.json'

beforeAll(() => {
  i18n.global.mergeLocaleMessage('en', { ...appMessages, ...adminMessages })
})

describe('keyed UI loading', () => {
  it('passes form-ready validation errors through unchanged', () => {
    const notify = vi.fn<(message: string) => void>()
    const fields = [{ field: 'value', code: 'SETTINGS_VALIDATION_INVALID', params: { min: 60 } }]
    const error = Object.assign(new Error('request'), {
      status: 422,
      problem: { code: 'INVALID', errors: fields },
    })
    const result = mutationError(error, notify)
    expect(result).toEqual({
      status: 'invalid',
      errors: [
        { name: 'value', message: 'errors.SETTINGS_VALIDATION_INVALID', params: { min: 60 } },
      ],
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('passes a decoded HTTP problem directly to form completion', async () => {
    const fields = [{ field: 'value', code: 'SETTINGS_VALIDATION_INVALID' }]
    const client = createHttpClient({
      fetch: async () =>
        new Response(
          JSON.stringify({
            status: 422,
            code: 'SETTINGS_VALIDATION_INVALID',
            errors: fields,
          }),
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    })
    const { error } = await client.put('/admin/settings/example', { value: 'bad' })
    const notify = vi.fn<(message: string) => void>()
    const result = mutationError(error, notify)
    expect(result).toEqual({
      status: 'invalid',
      errors: [{ name: 'value', message: 'errors.SETTINGS_VALIDATION_INVALID' }],
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('shows a trace reference for internal failures without exposing server text', () => {
    const notify = vi.fn<(message: string) => void>()
    const error = Object.assign(new Error('sensitive technical detail'), {
      status: 500,
      problem: { code: 'INTERNAL_SERVER_ERROR', traceId: '0123456789abcdef0123456789abcdef' },
    })
    expect(mutationError(error, notify)).toEqual({ status: 'error' })
    expect(notify.mock.calls[0]?.[0]).toContain('0123456789abcdef0123456789abcdef')
    expect(notify.mock.calls[0]?.[0]).not.toContain('sensitive technical detail')
  })

  it('resolves problem and field translations through the configured fallback locale', () => {
    const previous = i18n.global.locale.value
    const fallback = i18n.global.fallbackLocale.value
    i18n.global.locale.value = 'fr'
    i18n.global.fallbackLocale.value = 'en'
    i18n.global.mergeLocaleMessage('en', {
      errors: { FALLBACK_ONLY_TEST: 'Fallback message' },
    })
    try {
      const ui = useUi(createState())
      const error = Object.assign(new Error('private details'), {
        status: 422,
        problem: {
          code: 'FALLBACK_ONLY_TEST',
          errors: [{ field: 'value', code: 'FALLBACK_ONLY_TEST' }],
        },
      })
      expect(ui.mutationError(error)).toEqual({
        status: 'invalid',
        errors: [{ name: 'value', message: 'errors.FALLBACK_ONLY_TEST', params: undefined }],
      })
      ui.error(error)
      expect(ui.notification.value?.message).toBe('Fallback message')
    } finally {
      i18n.global.locale.value = previous
      i18n.global.fallbackLocale.value = fallback
    }
  })

  it('does not select a translation that exists only outside the fallback chain', () => {
    const previous = i18n.global.locale.value
    const fallback = i18n.global.fallbackLocale.value
    i18n.global.locale.value = 'en'
    i18n.global.fallbackLocale.value = 'en'
    i18n.global.mergeLocaleMessage('fr', { errors: { FRENCH_ONLY_TEST: 'Texte' } })
    try {
      const error = Object.assign(new Error('private details'), {
        status: 422,
        problem: {
          code: 'FRENCH_ONLY_TEST',
          errors: [{ field: 'value', code: 'FRENCH_ONLY_TEST' }],
        },
      })
      expect(mutationError(error, vi.fn())).toEqual({
        status: 'invalid',
        errors: [{ name: 'value', message: 'errors.validationFailed', params: undefined }],
      })
    } finally {
      i18n.global.locale.value = previous
      i18n.global.fallbackLocale.value = fallback
    }
  })

  it('uses the same safe error policy for actions, mutations and direct error reporting', async () => {
    const ui = useUi(createState())
    const error = new Error('private technical detail')
    ui.error(error)
    await ui.action('failed', () => {
      throw error
    })
    expect(ui.mutationError(error)).toEqual({ status: 'error' })
    expect(ui.notifications.value.map((item) => item.message)).toEqual(
      Array(3).fill('The request could not be completed. Please try again.'),
    )
    ui.error('auth.invalid.credentials')
    expect(ui.notification.value?.message).toBe('auth.invalid.credentials')
  })

  it('preserves explicit translated exception keys across all error paths', async () => {
    const ui = useUi(createState())
    const error = new Error('admin.loadUsersError')
    const message = 'admin.loadUsersError'
    ui.error(error)
    await ui.action('failed', () => {
      throw error
    })
    ui.mutationError(error)
    expect(ui.notifications.value.map((item) => item.message)).toEqual([message, message, message])
  })

  it('keeps a replaceable page alert independent of the snackbar queue and its lifecycle', async () => {
    const state = createState()
    const ui = useUi(state)
    const same = useUi(state)
    ui.alert('Page warning', { type: 'warning' })
    const warning = ui.notification.value!
    await ui.action('save', () => ui.success('Saved'))
    await ui.action('failed', () => Promise.reject(new Error('Failed')))
    expect(same.notification.value).toMatchObject({
      message: 'Page warning',
      presentation: 'alert',
      timeout: 0,
    })
    expect(same.snackbar.value).toBe(false)
    expect(ui.notificationQueue.value.map((item) => item.text)).toEqual([
      'Saved',
      'The request could not be completed. Please try again.',
    ])
    ui.resetNotificationQueue()
    ui.notificationQueue.value = ui.notificationQueue.value.slice(1)
    expect(ui.notification.value?.message).toBe('Page warning')
    ui.alert('Replacement')
    expect(ui.notifications.value.some((item) => item.id === warning.id)).toBe(false)
    expect(ui.notificationQueue.value.map((item) => item.text)).toEqual([
      'The request could not be completed. Please try again.',
    ])
    ui.clearSnackbars()
    expect(ui.notification.value?.message).toBe('Replacement')
    expect(ui.notificationQueue.value).toEqual([])
    ui.success('Still queued')
    ui.clearAlert()
    expect(ui.notification.value?.message).toBe('Still queued')
    expect(ui.snackbar.value).toBe(true)
    expect(ui.notificationQueue.value.map((item) => item.text)).toEqual(['Still queued'])
    ui.alert('Another alert')
    ui.clear()
    expect(ui.notifications.value).toEqual([])
  })

  it('expires only the current timed alert and cancels alert timers on clear', () => {
    vi.useFakeTimers()
    try {
      const ui = useUi(createState())
      ui.alert('First', { timeout: 1000 })
      vi.advanceTimersByTime(500)
      ui.alert('Replacement', { timeout: 2000 })
      ui.success('Queued')
      vi.advanceTimersByTime(500)
      expect(ui.notification.value?.message).toBe('Replacement')
      vi.advanceTimersByTime(1500)
      expect(ui.notification.value?.message).toBe('Queued')
      expect(ui.notificationQueue.value.map((item) => item.text)).toEqual(['Queued'])
      ui.alert('Cleared', { timeout: 1000 })
      ui.clearAlert()
      expect(vi.getTimerCount()).toBe(0)
      ui.alert('Cleared with all feedback', { timeout: 1000 })
      ui.clear()
      expect(vi.getTimerCount()).toBe(0)
      expect(ui.notification.value).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shares global overlay ownership through Pinia without changing operation activity', () => {
    const state = createState()
    const ui = useUi(state)
    const same = useUi(state)
    const other = useUi(createState())
    const finish = ui.loading.start('save')
    const finishOther = other.loading.start('save')
    expect(same.loading.global.value).toBe(true)
    expect(isReadonly(ui.loading.global)).toBe(true)

    const releaseFirst = ui.loading.registerOverlay()
    const releaseSecond = same.loading.registerOverlay()
    expect(same.loading.global.value).toBe(false)
    expect(ui.loading.active.value).toBe(true)
    expect(ui.loading.has('save')).toBe(true)
    expect(other.loading.global.value).toBe(true)
    ui.clear()
    expect(ui.loading.global.value).toBe(false)

    releaseFirst()
    releaseFirst()
    expect(same.loading.global.value).toBe(false)
    releaseSecond()
    expect(same.loading.global.value).toBe(true)
    releaseSecond()
    const releaseThird = ui.loading.registerOverlay()
    expect(same.loading.global.value).toBe(false)
    finish()
    releaseThird()
    expect(same.loading.global.value).toBe(false)
    expect(ui.loading.active.value).toBe(false)
    finishOther()
  })

  it('keeps consumed messages in app state until dismissal without queueing them twice', () => {
    const state = createState()
    const ui = useUi(state)
    const same = useUi(state)
    ui.success('First')
    ui.warning('Second')
    const [first] = ui.notificationQueue.value
    same.notificationQueue.value = same.notificationQueue.value.slice(1)
    expect(ui.notifications.value.map((item) => item.message)).toEqual(['First', 'Second'])
    expect(ui.notificationQueue.value.map((item) => item.text)).toEqual(['Second'])
    ui.info('Third')
    expect(same.notificationQueue.value.map((item) => item.text)).toEqual(['Second', 'Third'])
    first!.onDismiss()
    expect(ui.notifications.value.map((item) => item.message)).toEqual(['Second', 'Third'])
    ui.clear()
    ui.success('After clear')
    first!.onDismiss()
    expect(ui.notificationQueue.value.map((item) => item.text)).toEqual(['After clear'])
  })

  it('queues consecutive notifications without replacing earlier feedback', () => {
    const ui = useUi(createState())
    ui.success('Saved')
    ui.warning('Review', { timeout: 0 })
    ui.error('Failed', { timeout: 1000 })
    expect(
      ui.notifications.value.map(({ type, message, timeout }) => ({ type, message, timeout })),
    ).toEqual([
      { type: 'success', message: 'Saved', timeout: 5000 },
      { type: 'warning', message: 'Review', timeout: 0 },
      { type: 'error', message: 'Failed', timeout: 1000 },
    ])
    expect(new Set(ui.notifications.value.map((item) => item.id)).size).toBe(3)
    expect(ui.snackbar.value).toBe(true)
    const first = ui.notifications.value[0]!
    ui.dismiss(first.id)
    ui.dismiss(first.id)
    expect(ui.notifications.value.map((item) => item.message)).toEqual(['Review', 'Failed'])
    expect(ui.notification.value?.message).toBe('Failed')
    ui.clear()
    expect(ui.notifications.value).toEqual([])
    expect(ui.notification.value).toBeUndefined()
  })

  it('runs UI operations with loading and returns successful results', async () => {
    const ui = useUi(createState())
    ui.error('Old error')
    const pending = Promise.withResolvers<number>()
    const running = ui.action('save', () => pending.promise)
    expect(ui.loading.has('save')).toBe(true)
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'Old error' })
    pending.resolve(42)
    await expect(running).resolves.toEqual({ ok: true, data: 42 })
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'Old error' })
    expect(ui.loading.active.value).toBe(false)
  })

  it('preserves a completed operation notification when an unrelated operation starts', async () => {
    const ui = useUi(createState())
    await ui.action('save', () => ui.success('Saved'))
    const refresh = Promise.withResolvers<void>()
    const pending = ui.action('refresh', () => refresh.promise)
    expect(ui.loading.has('refresh')).toBe(true)
    expect(ui.notification.value).toMatchObject({ type: 'success', message: 'Saved' })
    refresh.resolve()
    await expect(pending).resolves.toEqual({ ok: true, data: undefined })
    expect(ui.notification.value).toMatchObject({ type: 'success', message: 'Saved' })
  })

  it.each(['sync', 'async'] as const)(
    'handles %s UI failures without an unhandled rejection',
    async (kind) => {
      const ui = useUi(createState())
      ui.success('Previous notification')
      const error = new Error('Save failed')
      await expect(
        ui.action('save', () => {
          if (kind === 'sync') throw error
          return Promise.reject(error)
        }),
      ).resolves.toEqual({ ok: false, error })
      expect(ui.notification.value).toMatchObject({
        type: 'error',
        message: 'The request could not be completed. Please try again.',
      })
      expect(ui.loading.active.value).toBe(false)
    },
  )

  it('distinguishes a successful undefined result from rejection with undefined', async () => {
    const ui = useUi(createState())
    await expect(ui.action('save', () => undefined)).resolves.toEqual({
      ok: true,
      data: undefined,
    })
    await expect(ui.action('save', () => Promise.reject(undefined))).resolves.toEqual({
      ok: false,
      error: undefined,
    })
    expect(ui.notification.value).toMatchObject({
      type: 'error',
      message: 'The request could not be completed. Please try again.',
    })
    expect(ui.loading.active.value).toBe(false)
  })

  it('counts same-key operations and releases each at most once', () => {
    const loading = createLoading()
    const first = loading.start('auth.login')
    const second = loading.start('auth.login')
    expect(loading.active.value).toBe(true)
    expect(loading.has('auth.login')).toBe(true)
    expect(loading.has('auth')).toBe(true)
    expect(loading.has('aut')).toBe(false)
    first()
    first()
    expect(loading.has('auth.login')).toBe(true)
    second()
    expect(loading.active.value).toBe(false)
    expect(isReadonly(loading.active)).toBe(true)
  })

  it('keeps independent operations and overlay requests separate', () => {
    const loading = createLoading()
    const login = loading.start('auth.login')
    const profile = loading.start('auth.profile')
    const overlay = loading.start('overlay.auth.login')
    overlay()
    login()
    expect(loading.has('auth.login')).toBe(false)
    expect(loading.has('auth.profile')).toBe(true)
    expect(loading.has('overlay')).toBe(false)
    expect(loading.active.value).toBe(true)
    profile()
    expect(loading.active.value).toBe(false)
  })

  it('preserves results and releases after synchronous throws and asynchronous failures', async () => {
    const loading = createLoading()
    const result = { saved: true }
    await expect(loading.run('save', () => result)).resolves.toBe(result)
    const error = new Error('Save failed')
    await expect(
      loading.run('save', () => {
        throw error
      }),
    ).rejects.toBe(error)
    await expect(loading.run('save', () => Promise.reject(error))).rejects.toBe(error)
    expect(loading.active.value).toBe(false)
  })

  it('keeps overlapping run calls active when one fails', async () => {
    const loading = createLoading()
    const first = Promise.withResolvers<number>()
    const second = Promise.withResolvers<number>()
    const pendingFirst = loading.run('save', () => first.promise)
    const pendingSecond = loading.run('save', () => second.promise)
    const error = new Error('Rejected')
    first.reject(error)
    await expect(pendingFirst).rejects.toBe(error)
    expect(loading.has('save')).toBe(true)
    second.resolve(42)
    await expect(pendingSecond).resolves.toBe(42)
    expect(loading.active.value).toBe(false)
  })

  it('rejects blank keys explicitly', () => {
    const loading = createLoading()
    expect(() => loading.start(' ')).toThrow('key is required')
    expect(loading.active.value).toBe(false)
  })

  it('shares state through Pinia without sharing between runtimes or clearing activity with alerts', async () => {
    const firstState = createState()
    const first = useUi(firstState)
    const same = useUi(firstState)
    const other = useUi(createState())
    const finish = first.loading.start('auth.login')
    first.error('Visible error')
    expect(same.loading.has('auth.login')).toBe(true)
    expect(other.loading.active.value).toBe(false)
    expect(same.notification.value?.message).toBe('Visible error')
    first.clear()
    expect(same.loading.active.value).toBe(true)
    expect(same.notification.value).toBeUndefined()
    expect(firstState.state.value.ui?.loadingCounts).toBeInstanceOf(Map)
    finish()
    expect(same.loading.active.value).toBe(false)
    await expect(first.loading.run('save', async () => 42)).resolves.toBe(42)
  })
})
