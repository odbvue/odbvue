import { describe, expect, it } from 'vitest'
import { isReadonly } from 'vue'
import { createState } from '@/capabilities/state'
import { createLoading } from '@/capabilities/ui/loading'
import { useUi } from '@/capabilities/ui/store'

describe('keyed UI loading', () => {
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
    first.error(new Error('Visible error'))
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
