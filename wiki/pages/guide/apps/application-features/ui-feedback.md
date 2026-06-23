# UI Feedback

1. Create store for providing UI feedback

::: details `apps\web\src\stores\ui.ts`

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed } from 'vue'

export interface AlertOptions {
  timeout?: number
  onRouteChange?: 'keep' | 'clear'
}

export const useUiStore = defineStore('ui', () => {
  const loading = ref(false)
  const info = ref('')
  const success = ref('')
  const warning = ref('')
  const error = ref('')
  const snack = ref('')
  const snackTimeout = ref(0)
  const snackbar = computed(() => !!snack.value)
  const activeAlertTimeout = ref<number | undefined>(undefined)
  const routeChangeBehavior = ref<'keep' | 'clear'>('keep')

  function clearActiveAlert() {
    info.value = ''
    success.value = ''
    warning.value = ''
    error.value = ''
    snack.value = ''
    snackTimeout.value = 0
    if (activeAlertTimeout.value !== undefined) {
      clearTimeout(activeAlertTimeout.value)
      activeAlertTimeout.value = undefined
    }
    routeChangeBehavior.value = 'keep'
  }

  function clearAll() {
    clearActiveAlert()
  }

  function clearAlertForRouteChange() {
    if (routeChangeBehavior.value !== 'clear') {
      return
    }

    clearActiveAlert()
  }

  function scheduleAlertClear(timeout: number) {
    if (activeAlertTimeout.value !== undefined) {
      clearTimeout(activeAlertTimeout.value)
    }

    if (timeout > 0) {
      activeAlertTimeout.value = window.setTimeout(() => {
        clearActiveAlert()
        activeAlertTimeout.value = undefined
      }, timeout)
    }
  }

  function setAlertBehavior(options: AlertOptions = {}) {
    routeChangeBehavior.value = options.onRouteChange ?? 'keep'
  }

  function setInfo(message: string, options: AlertOptions = {}) {
    clearAll()
    info.value = message
    setAlertBehavior(options)
    scheduleAlertClear(options.timeout ?? 0)
  }

  function setSuccess(message: string, options: AlertOptions = {}) {
    clearAll()
    success.value = message
    setAlertBehavior(options)
    scheduleAlertClear(options.timeout ?? 0)
  }

  function setWarning(message: string, options: AlertOptions = {}) {
    clearAll()
    warning.value = message
    setAlertBehavior(options)
    scheduleAlertClear(options.timeout ?? 0)
  }

  function setError(message: string, options: AlertOptions = {}) {
    clearAll()
    error.value = message
    setAlertBehavior(options)
    scheduleAlertClear(options.timeout ?? 0)
  }

  function setSnack(message: string, options: AlertOptions = {}) {
    clearAll()
    snack.value = message
    snackTimeout.value = options.timeout ?? 0
    setAlertBehavior(options)
    if ((options.timeout ?? 0) > 0) {
      scheduleAlertClear(options.timeout ?? 0)
    } else {
      if (activeAlertTimeout.value !== undefined) {
        clearTimeout(activeAlertTimeout.value)
        activeAlertTimeout.value = undefined
      }
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
    clearAll,
    clearAlertForRouteChange,
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

2. Include store into main store

::: details `apps\web\src\stores\index.ts`

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'
import { useSettingsStore } from './settings'
import { useNavigationStore } from './navigation'
import { useUiStore } from './ui'
import { version as packageVersion, title as packageTitle } from '../../../../package.json'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()
  const getNavigation = () => useNavigationStore()
  const getUi = () => useUiStore()

  return {
    version: packageVersion,
    title: packageTitle,
    settings: getSettings(),
    navigation: getNavigation(),
    ui: getUi(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
```

:::

3. Add components for feedback into default layout

::: details `apps\web\src\layouts\DefaultLayout.vue`

```vue
<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <!-- //.. -->
    </v-navigation-drawer>
    <v-app-bar>
      <!-- //.. -->
      <v-progress-linear
        :active="app.ui.loading"
        indeterminate
        absolute
        location="bottom"
        height="4"
      ></v-progress-linear>
    </v-app-bar>
    <v-app-bar>
      <!-- //.. -->
    </v-app-bar>

    <v-app-bar class="pa-2" v-if="app.ui.info">
      <v-alert type="info" :text="app.ui.info ? t(app.ui.info) : ''"></v-alert>
    </v-app-bar>
    <v-app-bar class="pa-2" v-if="app.ui.success">
      <v-alert type="success" :text="app.ui.success ? t(app.ui.success) : ''"></v-alert>
    </v-app-bar>
    <v-app-bar class="pa-2" v-if="app.ui.warning">
      <v-alert type="warning" :text="app.ui.warning ? t(app.ui.warning) : ''"></v-alert>
    </v-app-bar>
    <v-app-bar class="pa-2" v-if="app.ui.error">
      <v-alert type="error" :text="app.ui.error ? t(app.ui.error) : ''"></v-alert>
    </v-app-bar>

    <v-main class="ma-4">
      <slot />

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
      <!-- //.. -->
    </v-footer>
  </v-app>
</template>
```

:::

4. Modify sandbox to test UI feedback

::: details `apps\web\src\layouts\DefaultLayout.vue`

```vue
<template>
  <v-card prepend-icon="$mdiHome" :title="t('sandbox.title')">
    <v-card-text>{{ t('sandbox.description') }}</v-card-text>
    <v-card-actions>
      <v-btn @click="app.settings.toggleTheme()">Toggle theme</v-btn>
      <v-btn color="info" @click="app.ui.setInfo('Info message')">Info</v-btn>
      <v-btn color="info" @click="app.ui.setInfo('Info message 2 sec', { timeout: 2000 })"
        >Info 2 sec</v-btn
      >
      <v-btn color="info" @click="app.ui.setInfo('Info message clear', { onRouteChange: 'clear' })"
        >Info clear</v-btn
      >
      <v-btn color="success" @click="app.ui.setSuccess('Success message')">Success</v-btn>
      <v-btn color="warning" @click="app.ui.setWarning('Warning message')">Warning</v-btn>
      <v-btn color="error" @click="app.ui.setError('Error message')">Error</v-btn>
      <v-btn color="primary" @click="app.ui.setSnack('Snackbar message')">Snackbar</v-btn>
      <v-btn color="secondary" @click="app.ui.clearAll()">Clear All</v-btn>
      <v-btn color="secondary" @click="app.ui.startLoading()">Loading</v-btn>
    </v-card-actions>
  </v-card>
  <test-component />
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Sandbox',
    description: 'A sandbox page to test various UI components and features',
    icon: '$mdiFlask',
    color: '#DDEEFF',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const app = useAppStore()
const { t } = useI18n()
</script>
```

:::
