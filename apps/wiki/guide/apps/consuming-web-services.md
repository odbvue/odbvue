# Consuming Web Services

## Environment Variables

Create [Environment variables](https://vite.dev/guide/env-and-mode) to store information about service endpoint. Suggested approach is to keep in Environment variables just a bare minimum and to obtain most of configuration and settings from back-end.

For production `./.env.production`

```ini
VITE_API_URI = https://<domain>.adb.<region>.oraclecloudapps.com/ords/<schema>/
```

For local development `./.env.development.local`

```ini
VITE_API_URI = https://127.0.0.1:8443/ords/<schema>/
```

> [!NOTE]
> OdbVue philosophy is that the only `.env` variable for the app should be the main API endpoint.

## Server Proxy

To prevent [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) problem in local development, need to implement a proxy in `./vite.config.ts`

```ts
// ...
import { defineConfig, loadEnv } from 'vite'
// ...
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const isProduction = mode === 'production'

  return {
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URI,
          changeOrigin: true,
          secure: isProduction ? true : false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    plugins: [
      // ...
    ],
    resolve: {
      // ...
    },
  }
})
```

Also Vitest config need to be updated accordingly

#### `./vitest.config.ts`

::: details source
```ts
import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig(async (configEnv) => {
  const resolvedViteConfig = typeof viteConfig === 'function'
    ? await viteConfig(configEnv)
    : viteConfig

  return mergeConfig(
    resolvedViteConfig,
    {
      test: {
        environment: 'jsdom',
        exclude: [...configDefaults.exclude, 'e2e/**'],
        root: fileURLToPath(new URL('./', import.meta.url)),
        css: false,
        globals: true,
        server: {
          deps: {
            inline: ['vuetify'],
          },
        },
        setupFiles: ['./vitest.config.setup.ts'],
      },
    },
  )
})

```
:::

## HTTP Composable

1. Install [ofetch](https://github.com/unjs/ofetch) library.

```bash
pnpm add ofetch
```

2. Create `useHttp`composable to wrap `ofetch` with app's defaults.

#### `@/composables/http.ts`

```ts
import { $fetch } from 'ofetch'

const baseURL = (import.meta.env.DEV ? '/api/' : import.meta.env.VITE_API_URI)

export function useHttp() {
  return $fetch.create({
    baseURL
  })
}
```

## Consuming Service

1. Check that service works

```bash
https://localhost:8443/ords/odbvue/app/context/
# {"version":"v0.0.61"}
```

2. Modify apps main store to retrieve version from service.

#### `@/stores/index.ts`

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'
import { version as packageVersion, title as packageTitle } from '../../package.json'

export const useAppStore = defineStore('app', () => {
  const version = ref(`v${packageVersion}`)
  const title = ref(packageTitle)
  const getSettings = () => useSettingsStore()
  const getNavigation = () => useNavigationStore()
  const getUi = () => useUiStore()

  const api = useHttp()

  onMounted(async () => {
    const { version: dbVersion} = await api('app/context/')
    const isDev =  import.meta.env.DEV ? '-dev' : ''
    version.value = `v${packageVersion}-${dbVersion}${isDev}`
  })

  return { version, title, settings: getSettings(), navigation: getNavigation(), ui: getUi() }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
  import.meta.hot.accept(acceptHMRUpdate(useNavigationStore, import.meta.hot))
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}

```

3. Replace default layout to use version and title from the mains store

#### `@/layouts/DefaultLayout.vue`

```vue
<template>
  <v-app>
    <!-- // -->
    <v-footer app>
      <v-row>
        <v-col> {{ app.version }} </v-col>
        <!-- // -->
      </v-row>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
//
const app = useAppStore()
//
</script>
```

Further, on, calling web service is as lightweight as

```ts
  const api = useHttp()
  const { result } = await api('app/<method>/')
```
