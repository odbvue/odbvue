import type { PiniaPluginContext, StateTree, StoreGeneric } from 'pinia'

export type PersistStorage = 'localStorage' | 'sessionStorage' | 'indexedDB' | 'cookie'
export interface PersistCookieOptions {
  path?: string
  domain?: string
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  maxAge?: number
}
export interface PersistOptions {
  storage: PersistStorage
  key?: string
  paths?: string[]
  dbName?: string
  storeName?: string
  cookie?: PersistCookieOptions
}

const persistOptionsByStore = new WeakMap<StoreGeneric, PersistOptions>()

/** Returns persistence configured for an installed store, if any. */
export function getPersistOptions(store: StoreGeneric): PersistOptions | undefined {
  return persistOptionsByStore.get(store)
}

declare module 'pinia' {
  interface DefineStoreOptionsBase<S, Store> {
    persist?: PersistOptions
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function canUseIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined'
}
function setCookie(key: string, value: string, options: PersistCookieOptions = {}): void {
  let cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`
  if (options.path) cookie += `; Path=${options.path}`
  if (options.domain) cookie += `; Domain=${options.domain}`
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`
  if (options.secure) cookie += '; Secure'
  document.cookie = cookie
}
function getCookie(key: string): string | null {
  const prefix = `${encodeURIComponent(key)}=`
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length)
  return value === undefined ? null : decodeURIComponent(value)
}
async function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)
    request.addEventListener('upgradeneeded', () => {
      if (!request.result.objectStoreNames.contains(storeName))
        request.result.createObjectStore(storeName)
    })
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error), { once: true })
  })
}
async function idbGet(dbName: string, storeName: string, key: string): Promise<unknown> {
  const db = await openDB(dbName, storeName)
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error), { once: true })
  })
}
async function idbSet(
  dbName: string,
  storeName: string,
  key: string,
  value: unknown,
): Promise<void> {
  const db = await openDB(dbName, storeName)
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(value, key)
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('error', () => reject(transaction.error), { once: true })
  })
}
function pickPaths(state: Record<string, unknown>, paths?: string[]): Record<string, unknown> {
  if (!paths?.length) return state
  const picked: Record<string, unknown> = {}
  for (const path of paths) {
    const value = path
      .split('.')
      .reduce<unknown>(
        (current, segment) => (isRecord(current) ? current[segment] : undefined),
        state,
      )
    if (value !== undefined) {
      const segments = path.split('.')
      let current = picked
      for (const segment of segments.slice(0, -1))
        current = (current[segment] ??= {}) as Record<string, unknown>
      current[segments.at(-1)!] = value
    }
  }
  return picked
}

export default function piniaPersistPlugin({ store, options }: PiniaPluginContext): void {
  const persist = (options as { persist?: PersistOptions }).persist
  if (!persist) return
  persistOptionsByStore.set(store, persist)
  if (typeof window === 'undefined') return
  const persistOptions = persist
  const key = persistOptions.key ?? store.$id
  const dbName = persistOptions.dbName ?? 'pinia'
  const storeName = persistOptions.storeName ?? 'stores'
  if (persistOptions.storage === 'indexedDB' && !canUseIndexedDB()) return

  let isHydrating = true
  let isApplyingHydration = false
  let changedBeforeHydrationCompleted = false

  async function hydrate(): Promise<void> {
    try {
      const raw =
        persistOptions.storage === 'localStorage'
          ? window.localStorage.getItem(key)
          : persistOptions.storage === 'sessionStorage'
            ? window.sessionStorage.getItem(key)
            : persistOptions.storage === 'cookie'
              ? getCookie(key)
              : await idbGet(dbName, storeName, key)
      const state = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (isRecord(state) && !changedBeforeHydrationCompleted) {
        isApplyingHydration = true
        store.$patch(state as StateTree)
      }
    } catch (error) {
      console.warn('[pinia-persist] hydrate failed', error)
    } finally {
      isApplyingHydration = false
      isHydrating = false
      if (changedBeforeHydrationCompleted) void persistState(store.$state)
    }
  }

  async function persistState(state: StateTree): Promise<void> {
    try {
      const data = pickPaths(state as Record<string, unknown>, persistOptions.paths)
      if (persistOptions.storage === 'localStorage')
        window.localStorage.setItem(key, JSON.stringify(data))
      else if (persistOptions.storage === 'sessionStorage')
        window.sessionStorage.setItem(key, JSON.stringify(data))
      else if (persistOptions.storage === 'cookie')
        setCookie(key, JSON.stringify(data), persistOptions.cookie)
      else await idbSet(dbName, storeName, key, data)
    } catch (error) {
      console.warn('[pinia-persist] persist failed', error)
    }
  }

  store.$subscribe((_mutation, state) => {
    if (isApplyingHydration) return
    if (isHydrating) {
      changedBeforeHydrationCompleted = true
      return
    }
    void persistState(state)
  })
  void hydrate()
}
