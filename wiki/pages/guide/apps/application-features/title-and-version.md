# Title and Version

## Assets

Obtain and copy a 512x512 `logo.svg` and `favicon.ico` into `apps\web\public`.

## Application Metadata

Update the root `package.json` title.

```json{3}
{
  "name": "odbvue",
  "title": "OdbVue",
  "version": "1.0.0",
//..
```

Add the initial title to `apps\web\index.html`.

::: details `apps\web\index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- ... -->
    <title>OdbVue</title>
    <!-- ... -->
  </head>
  <body>
    <!-- ... -->
  </body>
</html>
```

:::

## Dynamic Page Title

Install [Unhead](https://unhead.unjs.io/) to enable manipulation of page head data.

```bash
pnpm install @unhead/vue
```

Add Unhead to the Vite auto-import configuration.

::: details `apps\web\vite.config.ts`

```ts{2,10}
// ...
import { unheadVueComposablesImports } from '@unhead/vue'
// ...
export default defineConfig({
  plugins: [
// ...
    AutoImport({
      imports: [
//...
        unheadVueComposablesImports,
//...
      ],
    })
  ],
})
```

:::

Create the `unhead` instance in `@/main.ts`.

::: details `apps\web\src\main.ts`

```ts
// ...
import { createHead } from '@unhead/vue/client'
// ...
app.use(createHead())
// ...
```

:::

Update the main store so it exposes the application title and version from the root package.

::: details `apps\web\src\stores\index.ts`

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'
import { useSettingsStore } from './settings'
import { version as packageVersion, title as packageTitle } from '../../../../package.json'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()

  return {
    version: packageVersion,
    title: packageTitle,
    settings: getSettings(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
```

:::

Enable a dynamic page title in the router.

::: details `apps\web\src\router\index.ts`

```ts
//...
import { title } from '../../../../package.json'
//...
router.beforeEach(async (_to) => {
  const appTitle = useAppStore().title || 'OdbVue'
  useHead({ title: appTitle })
  return true
})
// ...
```

:::

## Layout Integration

Update `apps\web\src\layouts\DefaultLayout.vue` to render the title and version from the app store.

::: details `apps\web\src\layouts\DefaultLayout.vue`

```vue{8,16,26}
<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <!-- //.. -->
    </v-navigation-drawer>
    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>{{ appStore.title }}</v-toolbar-title>
    </v-app-bar>
    <v-main class="ma-4">
      <slot />
    </v-main>
    <v-footer app>
      <v-row>
        <v-col>
          <span class="text-caption">v{{ appStore.version }}</span>
        </v-col>
        <!-- //.. -->
      </v-row>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
const drawer = ref(false)
const appStore = useAppStore()
const pages = ref([
  { title: 'Home', icon: '$mdiHome', path: '/' },
  { title: 'About', icon: '$mdiInformation', path: '/about' },
  { title: 'Sandbox', icon: '$mdiCog', path: '/sandbox' },
])
</script>
```

:::
