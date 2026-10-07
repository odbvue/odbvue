import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createOdbVueHooks } from '@/app/events'
import { installApp } from '@/app/plugins'
import { useAuth } from '@/app/auth'
import { useHttp } from '@/app/http'
import { useErrors } from '@/app/errors'

describe('application startup', () => {
  afterEach(() => vi.restoreAllMocks())

  it('delivers typed configured and subscribed event handlers', async () => {
    const configured = vi.fn<() => void>()
    const subscribed = vi.fn<() => void>()
    const hooks = createOdbVueHooks({ 'app:started': configured })
    hooks.on('app:started', subscribed)
    await hooks.emit('app:started', undefined)
    expect(configured).toHaveBeenCalledOnce()
    expect(subscribed).toHaveBeenCalledOnce()
  })

  it('provides one auth, HTTP and error service per application', async () => {
    const app = createApp({})
    const services = installApp(app, {})
    vi.spyOn(services.auth, 'restore').mockResolvedValue(false)
    app.runWithContext(() => {
      expect(useAuth()).toBe(services.auth)
      expect(useHttp()).toBe(services.http)
      expect(useErrors()).toBe(services.errors)
    })
    await services.ready
  })

  it('restores once before emitting app:started and becoming ready', async () => {
    let finish!: () => void
    const startup = new Promise<boolean>((resolve) => {
      finish = () => resolve(false)
    })
    const started = vi.fn<() => void>()
    const services = installApp(createApp({}), { hooks: { 'app:started': started } })
    const restore = vi.spyOn(services.auth, 'restore').mockReturnValue(startup)
    let ready = false
    void services.ready.then(() => {
      ready = true
    })
    await vi.waitFor(() => expect(restore).toHaveBeenCalledOnce())
    expect(started).not.toHaveBeenCalled()
    expect(ready).toBe(false)
    finish()
    await services.ready
    expect(started).toHaveBeenCalledOnce()
    expect(ready).toBe(true)
    expect(restore).toHaveBeenCalledOnce()
  })

  it('rejects readiness and reports startup failure without emitting app:started', async () => {
    const error = new Error('Restore failed')
    const started = vi.fn<() => void>()
    const services = installApp(createApp({}), { hooks: { 'app:started': started } })
    vi.spyOn(services.auth, 'restore').mockRejectedValue(error)
    await expect(services.ready).rejects.toBe(error)
    expect(started).not.toHaveBeenCalled()
    expect(services.errors.getEvents()).toEqual([
      expect.objectContaining({ message: 'Restore failed', source: 'app', operation: 'startup' }),
    ])
  })

  it('includes asynchronous startup events in readiness', async () => {
    const error = new Error('Startup handler failed')
    const services = installApp(createApp({}), {
      hooks: {
        'app:started': async () => {
          throw error
        },
      },
    })
    vi.spyOn(services.auth, 'restore').mockResolvedValue(false)
    await expect(services.ready).rejects.toBe(error)
  })
})
