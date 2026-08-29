import { defineStore } from 'pinia'
import { createApp, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { createOdbVuePinia, getOdbVueStores } from '../src/index.js'

describe('OdbVue Pinia state', () => {
  it('lists stores registered through its public plugin hook', () => {
    const pinia = createOdbVuePinia()
    createApp({}).use(pinia)
    const useCounterStore = defineStore('counter', { state: () => ({ count: 0 }) })
    const counter = useCounterStore(pinia)

    expect(getOdbVueStores(pinia)).toEqual([counter])
  })

  it('does not read stores from Pinia runtimes it does not create', () => {
    const pinia = createOdbVuePinia()

    expect(getOdbVueStores(pinia)).toEqual([])
  })

  it('hydrates JSON state persisted in a cookie', async () => {
    document.cookie = `counter-persist=${encodeURIComponent(JSON.stringify({ count: 42 }))}; Path=/`
    const pinia = createOdbVuePinia()
    createApp({}).use(pinia)
    const useCounterStore = defineStore('counter-persist', {
      state: () => ({ count: 0 }),
      persist: { storage: 'cookie' },
    })

    const counter = useCounterStore(pinia)
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(counter.count).toBe(42)
    document.cookie = 'counter-persist=; Max-Age=0; Path=/'
  })
})
