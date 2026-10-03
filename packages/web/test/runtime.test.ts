import { describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import {
  createOdbVueHooks,
  defineCapability,
  defineContract,
  defineOdbVueApp,
  installOdbVue,
  resolveOdbVueCapabilities,
} from '../src/index.js'

describe('OdbVue runtime primitives', () => {
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
    const started = vi.fn<() => void>()
    const runtime = installOdbVue(
      createApp({}),
      defineOdbVueApp({ hooks: { 'app:started': started } }),
    )

    expect(() => runtime.get(defineContract<string>('missing'))).toThrow(
      'The requested OdbVue contract is not available.',
    )
    await Promise.resolve()
    expect(started).toHaveBeenCalledOnce()
  })
})
