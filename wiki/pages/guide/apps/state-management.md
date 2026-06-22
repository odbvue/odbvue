# State Management

## Overview

State management in Vue.js refers to the practice of centrally handling shared data (state) across multiple components, ensuring consistent and predictable behavior throughout an application.

Instead of passing props and emitting events between deeply nested components, a state management library [Pinia](https://pinia.vuejs.org/) provides a single source of truth for your app’s data. With Pinia, developers can easily store, update, and access reactive state in a clear and organized way. This leads to cleaner code, simpler debugging, and improved scalability as the application grows.

## Enabling Pinia

Current application setup comes with prebuilt state management library. This section will show how to enhance Pinia stores with configurable persistence and rehydration.

1. Create a Pinia plugin for persisted state.

::: details `apps\web\src\plugins\pinia-persist.ts`

```ts
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
```

:::

2. Modify `@/main.ts` to add persist plugin to pinia.

```ts{8,12-14}
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import i18n from './plugins/i18n'
import piniaPersist from './plugins/pinia-persist'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPersist)
app.use(pinia)

app.use(router)
app.use(vuetify)
app.use(i18n)

app.mount('#app')
```

3. Create settings store `@/stores/settings.ts`

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'

import { ref, watch } from 'vue'

import vuetify from '@/plugins/vuetify'

const themes = ['system', 'light', 'dark'] as const

type ThemeName = (typeof themes)[number]

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const theme = ref<ThemeName>('system')

    watch(
      theme,
      (nextTheme) => {
        void vuetify.theme.change(nextTheme)
      },
      { immediate: true },
    )

    function setTheme(nextTheme: ThemeName) {
      theme.value = nextTheme
    }

    function toggleTheme() {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
    }

    return { theme, themes, setTheme, toggleTheme }
  },
  {
    persist: {
      storage: 'localStorage',
      paths: ['theme'],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
```

5. Create main store - a container for all app stores `apps\web\src\stores\index.ts`

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'
import { useSettingsStore } from './settings'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()

  return {
    settings: getSettings(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
```

6. Modify `@/pages/sandbox/index.vue` to use store for persisting theme - after closing and reopening browser theme is as it was set before

```vue
<template>
  <v-card prepend-icon="$mdiHome" :title="t('sandbox.title')">
    <v-card-text>{{ t('sandbox.description') }}</v-card-text>
    <v-card-actions>
      <v-btn @click="app.settings.toggleTheme()">Toggle theme</v-btn>
      <v-btn @click="locale = 'en'">en</v-btn>
      <v-btn @click="locale = 'fr'">fr</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'

const app = useAppStore()
const { locale, t } = useI18n()
</script>
```

7. Test

If toggling theme, it will change in localStorage and will persist after page reload.
