# Home Page

1. Create UI composable for background

::: details `apps\web\src\composables\ui.ts`

```ts
import { computed } from 'vue'
import { useTheme } from 'vuetify'

export function useCardBackground(color: string) {
  const theme = useTheme()

  return computed(() => {
    const dark = theme.current.value.dark
    const grFrom = dark ? '33' : '66'
    const grTo = dark ? '66' : '33'

    return {
      background: `linear-gradient(135deg, ${color}${grFrom} 33%, ${color}${grTo} 100%)`,
    }
  })
}
```

:::

2. Apply page meta for About page

::: details `apps\web\src\pages\about.md`

```md
---
title: About
description: About page
icon: $mdiInformation
color: #C7C7C7
visibility: always
access: always
---

# About

This is an `About` page
```

:::

3. Apply page meta for Sandbox page

::: details `apps\web\src\pages\sandbox\index.vue`

```vue
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

//..
</script>
```

:::

4. Modify Home page to display tiles

::: details `apps\web\src\pages\index.vue`

```vue
<template>
  <v-row>
    <v-col
      cols="12"
      md="4"
      v-for="page in navigationPages"
      :key="page.path"
    >
      <v-card
        hover
        class="h-100"
        :style="useCardBackground(page.meta.color || '#ffffff').value"
        :prepend-icon="page.meta.icon"
        :title="page.title"
        :to="page.path"
        :text="page.meta.description"
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
    visibility: 'always',
    access: 'always',
  },
})

const routing = useRouting()
const navigationPages = computed(() => routing.pages.value.filter((page) => page.path !== '/'))
import { useCardBackground } from '@/composables/ui'
const app = useAppStore()
</script>
```

:::
