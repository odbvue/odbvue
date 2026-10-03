import { defineStore } from 'pinia'
import { createApp, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { createOdbVuePinia, getOdbVueStores } from '../src/index.js'

async function readIndexedDB(dbName: string, storeName: string, key: string): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName)
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error), { once: true })
  })
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)
      request.addEventListener('success', () => resolve(request.result), { once: true })
      request.addEventListener('error', () => reject(request.error), { once: true })
    })
  } finally {
    db.close()
  }
}

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

  it('persists selected setup-store refs in localStorage', async () => {
    const pinia = createOdbVuePinia()
    createApp({}).use(pinia)
    const usePreferencesStore = defineStore(
      'preferences-persist',
      () => {
        const fontSize = ref(100)
        return { fontSize }
      },
      { persist: { storage: 'localStorage', paths: ['fontSize'] } },
    )

    const preferences = usePreferencesStore(pinia)
    preferences.fontSize = 150

    await vi.waitFor(() => {
      expect(window.localStorage.getItem('preferences-persist')).toBe('{"fontSize":150}')
    })
    window.localStorage.removeItem('preferences-persist')
  })

  it('persists stores in separate IndexedDB object stores', async () => {
    const dbName = `pinia-persist-${crypto.randomUUID()}`
    const useFirstStore = defineStore('first-indexed-store', {
      state: () => ({ count: 0 }),
      persist: { storage: 'indexedDB', dbName, storeName: 'first' },
    })
    const useSecondStore = defineStore('second-indexed-store', {
      state: () => ({ count: 0 }),
      persist: { storage: 'indexedDB', dbName, storeName: 'second' },
    })
    const pinia = createOdbVuePinia()
    createApp({}).use(pinia)
    const first = useFirstStore(pinia)
    const second = useSecondStore(pinia)

    await new Promise((resolve) => setTimeout(resolve, 0))
    first.$patch({ count: 1 })
    second.$patch({ count: 2 })
    await vi.waitFor(async () => {
      await expect(readIndexedDB(dbName, 'first', first.$id)).resolves.toEqual({ count: 1 })
      await expect(readIndexedDB(dbName, 'second', second.$id)).resolves.toEqual({ count: 2 })
    })

    const hydratedPinia = createOdbVuePinia()
    createApp({}).use(hydratedPinia)
    const hydratedFirst = useFirstStore(hydratedPinia)
    const hydratedSecond = useSecondStore(hydratedPinia)

    await vi.waitFor(() => {
      expect(hydratedFirst.count).toBe(1)
      expect(hydratedSecond.count).toBe(2)
    })
  })
})
