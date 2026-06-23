# Application Features

## Overview

This section will guide through creating a set of core features and a default layout, resulting in complete and reusable web application.

- **navigation** helpers - menu, breadcrumbs

- **UI capabilities** - alerts, snack-bars, loading.

- **page not found** implementation.

- dnd

:::

4. Enhance Home view with cards representing pages.

#### `@/pages/index.vue`

::: details source

```vue
<template>
  <v-row>
    <v-col
      cols="12"
      md="4"
      v-for="page in app.navigation.pages.filter((page) => page.path !== '/')"
      :key="page.path"
    >
      <v-card
        min-height="8em"
        hover
        :style="useCardBackground(page.color || '#ffffff').value"
        :prepend-icon="page.icon"
        :title="page.title"
        :to="page.path"
        :text="page.description"
      >
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Home',
    description: 'Welcome to the home page',
    icon: '$mdiHome',
    color: '#ABCDEF',
  },
})
import { useCardBackground } from '@/composables/ui'
const app = useAppStore()
</script>
```

:::

## UI Features

1. Create store for managing UI state

#### `@/stores/app/ui.ts`

:::details source

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'

export const useUiStore = defineStore('ui', () => {
  const loading = ref(false)
  const info = ref('')
  const success = ref('')
  const warning = ref('')
  const error = ref('')
  const snack = ref('')
  const snackTimeout = ref(0)
  const snackbar = computed(() => !!snack.value)

  function clearMessages() {
    info.value = ''
    success.value = ''
    warning.value = ''
    error.value = ''
    snack.value = ''
    snackTimeout.value = 0
  }

  function setInfo(message: string) {
    clearMessages()
    info.value = message
  }

  function setSuccess(message: string) {
    clearMessages()
    success.value = message
  }

  function setWarning(message: string) {
    clearMessages()
    warning.value = message
  }

  function setError(message: string) {
    clearMessages()
    error.value = message
  }

  function setSnack(message: string, timeout = 0) {
    clearMessages()
    snack.value = message
    if (timeout > 0) {
      snackTimeout.value = timeout
      setTimeout(() => {
        snack.value = ''
        snackTimeout.value = 0
      }, timeout)
    }
  }

  function startLoading() {
    loading.value = true
  }

  function stopLoading() {
    loading.value = false
  }

  return {
    loading,
    info,
    success,
    warning,
    error,
    snack,
    snackTimeout,
    snackbar,
    clearMessages,
    setInfo,
    setSuccess,
    setWarning,
    setError,
    setSnack,
    startLoading,
    stopLoading,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
```

:::

2. Add to Main Store

#### `@/stores/index.ts`

::: details source

```ts{6,8,14}
import { defineStore, acceptHMRUpdate } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()
  const getNavigation = () => useNavigationStore()
  const getUi = () => useUiStore()

  return { settings: getSettings(), navigation: getNavigation(), ui: getUi() }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
  import.meta.hot.accept(acceptHMRUpdate(useNavigationStore, import.meta.hot))
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
```

:::

3. Add Components to Default View

#### `@/layouts/DefaultLayout.vue`

::: details source

```vue
<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <!-- ... -->
    </v-navigation-drawer>
    <v-app-bar>
      <!-- ... -->
      <v-progress-linear
        :active="app.ui.loading"
        indeterminate
        absolute
        location="bottom"
        height="6"
      ></v-progress-linear>
    </v-app-bar>
    <v-app-bar>
      <v-alert
        type="info"
        :text="app.ui.info ? t(app.ui.info) : ''"
        v-show="app.ui.info.length > 0"
        class="mb-2"
      ></v-alert>
      <v-alert
        type="warning"
        :text="app.ui.warning ? t(app.ui.warning) : ''"
        v-show="app.ui.warning.length > 0"
        class="mb-2"
      ></v-alert>
      <v-alert
        type="error"
        :text="app.ui.error ? t(app.ui.error) : ''"
        v-show="app.ui.error.length > 0"
        class="mb-2"
      ></v-alert>
    </v-app-bar>
    <v-main class="ma-4" id="main" tabindex="-1">
      <!-- ... -->
      <v-snackbar v-model="app.ui.snackbar">
        {{ app.ui.snack }}
        <template v-slot:actions>
          <v-btn color="pink" variant="text" @click="app.ui.snack = ''">
            {{ t('close') }}
          </v-btn>
        </template>
      </v-snackbar>
      <v-overlay v-model="app.ui.loading" contained></v-overlay>
    </v-main>
    <v-footer app>
      <!-- ... -->
    </v-footer>
  </v-app>
</template>
```

:::

4. Refactor `@/pages/sandbox/index.ts to test UI capabilities`

#### `@/pages/sandbox/index.ts`

::: details source

```vue
<template>
  <v-card :style="cardBackground">
    <v-card-title> <v-icon icon="$mdiMinus" />{{ t('sandbox.title') }} </v-card-title>
    <v-card-subtitle>{{ t('sandbox.description') }}</v-card-subtitle>
    <v-card-text>
      <v-row>
        <v-col>
          <h3 class="mb-4">Alerts & snackbar</h3>
          <v-btn class="ma-1" color="info" @click="app.ui.setInfo('This is info!')"
            >Show Info</v-btn
          >
          <v-btn class="ma-1" color="warning" @click="app.ui.setWarning('This is warning!')"
            >Show Warning</v-btn
          >
          <v-btn class="ma-1" color="error" @click="app.ui.setError('This is error!')"
            >Show Error</v-btn
          >
          <v-btn class="ma-1" color="success" @click="app.ui.setSuccess('This is success!')"
            >Show Success</v-btn
          >
          <v-btn
            class="ma-1"
            color="primary"
            @click="app.ui.setSnack('This is snackbar info!', 3000)"
            >Show Snackbar Info</v-btn
          >
          <v-btn class="ma-1" color="secondary" @click="app.ui.clearMessages()">Clear All</v-btn>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <h3 class="mb-4">loading</h3>
          <v-btn class="ma-1" color="primary" @click="app.ui.startLoading()">Start Loading</v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
const cardBackground = useCardBackground('#ccccee')
const { t } = useI18n()
const app = useAppStore()
</script>
```

:::

5. Modify Router to clear all UI alerts on new routes

#### `@/router/index.ts`

```ts{7}
//...
router.beforeEach(async (to) => {
  const appTitle = title || 'OdbVue'
  const pageTitle = useNavigationStore().title(to.path)
  const documentTitle = pageTitle ? `${appTitle} - ${pageTitle}` : appTitle
  useHead({ title: documentTitle })
  useUiStore().clearMessages()
  return true
})
// ...
```

## Page Not Found

Create Page Not Found page

#### `@/pages/[...path].vue`

```vue
<template>
  <v-container fluid class="d-flex align-center justify-center" style="height: 100vh">
    <v-col cols="12" class="text-center">
      <img src="/logo.svg" alt="Not Found" />
      <h1>Page not found!</h1>
      <p>Ups! The page you are looking for does not exist.</p>
      <router-link to="/">Home</router-link>
    </v-col>
  </v-container>
</template>

<route>
  { meta: { layout: 'fullscreen' } }
</route>
```

## Drag & Drop (composable)

For simple Kanban-style interactions (move cards between columns) you can use a small HTML5 drag-and-drop composable. It centralizes drag state, drop-target highlighting helpers, and provides default inline styles that follow the Vuetify theme.

#### `@/composables/dnd.ts`

::: details source
//<<<../../../src/composables/dnd.ts
:::
