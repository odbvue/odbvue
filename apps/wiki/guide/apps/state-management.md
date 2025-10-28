# State Management

## Overview

State management in Vue.js refers to the practice of centrally handling shared data (state) across multiple components, ensuring consistent and predictable behavior throughout an application. 

Instead of passing props and emitting events between deeply nested components, a state management library  [Pinia](https://pinia.vuejs.org/) provides a single source of truth for your app’s data. With Pinia, developers can easily store, update, and access reactive state in a clear and organized way. This leads to cleaner code, simpler debugging, and improved scalability as the application grows.

## Enabling Pinia

Current application setup comes with prebuilt state management library. This section will show how to enhance Pinia stores with configurable persistence and rehydration.

1. Install a Pinia plugin for persisted state.

```bash
pnpm install @erlihs/pinia-plugin-storage
```

2. Modify `@/main.ts` to add persist plugin to pinia.

```ts
// ...
import { createPiniaPluginStorage } from '@erlihs/pinia-plugin-storage'
// ...
app.use(createPinia().use(createPiniaLocalStoragePlugin()))
// ...
```

3. Create app store `@/stores/settings.ts`

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, watch } from 'vue'
import { useTheme } from 'vuetify'

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const setTheme = useTheme()

    const theme = ref(setTheme.global.current.value.dark ? 'dark' : 'light')

    watch(theme, (newTheme) => {
      setTheme.change(newTheme)
    })

    function themeToggle() {
      theme.value = theme.value === 'light' ? 'dark' : 'light'
      setTheme.change(theme.value)
    }

    return { theme, themeToggle }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['theme'],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
```

4. Modify `@/pages/sandbox/index.vue` to use store for persisting theme - after closing and reopening browser theme is as it was set before

```vue{8,16,20}
<template>
  <v-card :style="cardBackground">
    <v-card-title><v-icon icon="$mdiHome" />{{ t('sandbox.title') }}</v-card-title>
    <v-card-text>{{ t('sandbox.description') }}</v-card-text>
    <v-card-actions>
      <v-btn @click="console.log('Primary!')" color="primary">Primary</v-btn>
      <v-btn @click="console.log('Secondary!')" color="secondary">Secondary</v-btn>
      <v-btn @click="settings.themeToggle()">Toggle theme</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useCardBackground } from '@/composables/ui'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'

const cardBackground = useCardBackground('#0000ff')
const { t } = useI18n()
const settings = useSettingsStore()
</script>
```

5. Test

If toggling theme, it will change in localStorage and will persist after page reload. 
