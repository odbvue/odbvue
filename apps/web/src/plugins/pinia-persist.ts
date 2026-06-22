import type { PiniaPluginContext, StateTree } from 'pinia'

type PersistStorage = 'localStorage' | 'sessionStorage' | 'indexedDB' | 'cookie'

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

declare module 'pinia' {
  export interface DefineStoreOptionsBase<S, Store> {
    persist?: PersistOptions
  }
}

const DEFAULT_DB_NAME = 'pinia'
const DEFAULT_STORE_NAME = 'stores'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getByPath(source: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, segment) => (isRecord(current) ? current[segment] : undefined),
      source,
    )
}

function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.').filter(Boolean)
  if (segments.length === 0) return

  let current: Record<string, unknown> = target
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment]
    if (!isRecord(next)) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }

  current[segments.at(-1)!] = value
}

function pickPaths(state: Record<string, unknown>, paths?: string[]): Record<string, unknown> {
  if (!paths?.length) return state

  const picked: Record<string, unknown> = {}
  for (const path of paths) {
    const value = getByPath(state, path)
    if (value !== undefined) {
      setByPath(picked, path, value)
    }
  }

  return picked
}

function canUseDOM(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function canUseIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined'
}

function setCookie(key: string, value: string, options: PersistCookieOptions = {}): void {
  let cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`
  }
  if (options.path) {
    cookie += `; Path=${options.path}`
  }
  if (options.domain) {
    cookie += `; Domain=${options.domain}`
  }
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`
  }
  if (options.secure) {
    cookie += '; Secure'
  }

  document.cookie = cookie
}

function getCookie(key: string): string | null {
  const prefix = `${encodeURIComponent(key)}=`

  for (const cookie of document.cookie.split('; ')) {
    if (cookie.startsWith(prefix)) {
      return decodeURIComponent(cookie.slice(prefix.length))
    }
  }

  return null
}

async function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)

    request.addEventListener('upgradeneeded', () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName)
      }
    })

    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error), { once: true })
  })
}

async function idbGet(dbName: string, storeName: string, key: string): Promise<unknown> {
  const db = await openDB(dbName, storeName)

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).get(key)

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
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value, key)
    tx.addEventListener('complete', () => resolve(), { once: true })
    tx.addEventListener('error', () => reject(tx.error), { once: true })
  })
}

function parsePersistedValue(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null

  if (typeof raw === 'string') {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : null
  }

  return isRecord(raw) ? raw : null
}

function resolveStorageAvailability(storage: PersistStorage): boolean {
  if (!canUseDOM()) return false
  if (storage === 'indexedDB') return canUseIndexedDB()
  return true
}

export default function piniaPersistPlugin({ store, options }: PiniaPluginContext): void {
  const persist = (options as { persist?: PersistOptions }).persist
  if (!persist) return
  const persistOptions = persist

  if (!resolveStorageAvailability(persistOptions.storage)) {
    return
  }

  const key = persistOptions.key ?? store.$id
  const dbName = persistOptions.dbName ?? DEFAULT_DB_NAME
  const storeName = persistOptions.storeName ?? DEFAULT_STORE_NAME

  let isHydrating = true
  let isApplyingHydration = false
  let changedBeforeHydrationCompleted = false

  async function hydrate(): Promise<void> {
    try {
      let raw: unknown = null

      switch (persistOptions.storage) {
        case 'localStorage':
          raw = window.localStorage.getItem(key)
          break
        case 'sessionStorage':
          raw = window.sessionStorage.getItem(key)
          break
        case 'cookie':
          raw = getCookie(key)
          break
        case 'indexedDB':
          raw = await idbGet(dbName, storeName, key)
          break
      }

      const parsed = parsePersistedValue(raw)
      if (!parsed || changedBeforeHydrationCompleted) return

      isApplyingHydration = true
      store.$patch(parsed as StateTree)
    } catch (error) {
      console.warn('[pinia-persist] hydrate failed', error)
    } finally {
      isApplyingHydration = false
      isHydrating = false

      if (changedBeforeHydrationCompleted) {
        void persistState(store.$state)
      }
    }
  }

  async function persistState(state: StateTree): Promise<void> {
    try {
      const data = pickPaths(state as Record<string, unknown>, persistOptions.paths)

      switch (persistOptions.storage) {
        case 'localStorage':
          window.localStorage.setItem(key, JSON.stringify(data))
          break
        case 'sessionStorage':
          window.sessionStorage.setItem(key, JSON.stringify(data))
          break
        case 'cookie':
          setCookie(key, JSON.stringify(data), persistOptions.cookie)
          break
        case 'indexedDB':
          await idbSet(dbName, storeName, key, data)
          break
      }
    } catch (error) {
      console.warn('[pinia-persist] persist failed', error)
    }
  }

  store.$subscribe((_mutation, state) => {
    if (isApplyingHydration) {
      return
    }

    if (isHydrating) {
      changedBeforeHydrationCompleted = true
      return
    }

    void persistState(state)
  })

  void hydrate()
}
