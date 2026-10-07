import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import {
  createOdbVueHooks,
  defineCapability,
  defineContract,
  defineOdbVueApp,
  installOdbVue,
  resolveOdbVueCapabilities,
  authCapability,
  errorsContract,
} from '../src/index.js'

describe('OdbVue runtime primitives', () => {
  afterEach(() => vi.restoreAllMocks())
  it('delivers typed configured and subscribed hook handlers', async () => {
    const configured = vi.fn<() => void>()
    const subscribed = vi.fn<() => void>()
    const hooks = createOdbVueHooks({ 'app:started': configured })
    hooks.on('app:started', subscribed)

    await hooks.emit('app:started', undefined)

    expect(configured).toHaveBeenCalledOnce()
    expect(subscribed).toHaveBeenCalledOnce()
  })

  it('orders capability setup by declared requirements', () => {
    const first = defineCapability({ name: 'first' })
    const second = defineCapability({ name: 'second', requires: ['first'] })

    expect(resolveOdbVueCapabilities([second, first])).toEqual([first, second])
    expect(() => resolveOdbVueCapabilities([second])).toThrow(
      'Capability "second" requires capability "first".',
    )
  })

  it('rejects missing contracts and emits app startup', async () => {
    vi.spyOn(authCapability, 'start').mockResolvedValue(undefined)
    const started = vi.fn<() => void>()
    const runtime = installOdbVue(
      createApp({}),
      defineOdbVueApp({ hooks: { 'app:started': started } }),
    )

    expect(() => runtime.get(defineContract<string>('missing'))).toThrow(
      'The requested OdbVue contract is not available.',
    )
    await runtime.ready
    expect(started).toHaveBeenCalledOnce()
  })

  it('waits for capability startup before emitting app:started and becoming ready', async () => {
    let finish!: () => void
    const startup = new Promise<void>((resolve) => {
      finish = resolve
    })
    const start = vi.spyOn(authCapability, 'start').mockReturnValue(startup)
    const started = vi.fn<() => void>()
    const runtime = installOdbVue(createApp({}), { hooks: { 'app:started': started } })
    let ready = false
    void runtime.ready.then(() => {
      ready = true
    })
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce())
    expect(started).not.toHaveBeenCalled()
    expect(ready).toBe(false)
    finish()
    await runtime.ready
    expect(started).toHaveBeenCalledOnce()
    expect(ready).toBe(true)
  })

  it('rejects readiness and reports startup failures without emitting app:started', async () => {
    const error = new Error('Restore failed')
    vi.spyOn(authCapability, 'start').mockRejectedValue(error)
    const started = vi.fn<() => void>()
    const runtime = installOdbVue(createApp({}), { hooks: { 'app:started': started } })

    await expect(runtime.ready).rejects.toBe(error)
    expect(started).not.toHaveBeenCalled()
    expect(runtime.get(errorsContract).getEvents()).toEqual([
      expect.objectContaining({
        message: 'Restore failed',
        source: 'runtime',
        operation: 'startup',
      }),
    ])
  })

  it('includes asynchronous startup hooks in readiness', async () => {
    vi.spyOn(authCapability, 'start').mockResolvedValue(undefined)
    const error = new Error('Startup hook failed')
    const runtime = installOdbVue(createApp({}), {
      hooks: {
        'app:started': async () => {
          throw error
        },
      },
    })
    await expect(runtime.ready).rejects.toBe(error)
  })
})
