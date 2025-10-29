# Layouts

## Overview

Layouts are reusable page wrappers that define the shared structure and UI elements around your content — such as headers, sidebars, and footers.

They let different parts of your app share consistent visual frameworks while still rendering unique views inside. By switching layouts dynamically, based on route, can easily present different page shells — like an admin dashboard, public site, or auth screen, without duplicating layout code.

## Implementation

1. Create two layouts 

#### `@/layouts/DefaultLayout.vue`

```vue
<template>
  <h1>Welcome!</h1>
  <slot />
</template>

```

#### `@/layouts/FullscreenLayout.vue`

```vue
<template>
  <slot />
</template>
```

2. Modify application to dynamically detect and load layout from `route.meta.layout` (if not set, assume as `default`).

#### `@/App.vue`

```vue
<template>
  <component :is="LayoutComponent">
    <RouterView />
  </component>
  <RouterLink to="/">Home</RouterLink>
  |
  <RouterLink to="/about">About</RouterLink>
  |
  <RouterLink to="/sandbox">Sandbox</RouterLink>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, defineAsyncComponent } from 'vue'

const layoutModules = import.meta.glob('./layouts/*.vue')

function extractName(path: string) {
  return path
    .split('/')
    .pop()
    ?.replace(/\.\w+$/, '')
    .replace(/Layout$/i, '')
    .toLowerCase()
}

const availableLayouts: Record<string, () => Promise<Record<string, unknown>>> = {}
for (const path in layoutModules) {
  const name = extractName(path)
  if (name) {
    availableLayouts[name] = layoutModules[path] as () => Promise<Record<string, unknown>>
  }
}

const route = useRoute()

const LayoutComponent = computed(() => {
  const name = (route.meta?.layout as string) || 'default'
  const key = name.toLowerCase()

  const loader = availableLayouts[key]
  if (!loader) {
    throw new Error(`[Layout] Missing layout: ${name}`)
  }

  return defineAsyncComponent(loader)
})
</script>
```

3. Add route meta information for a page to see it in action

#### `@/pages/sandbox/index.vue`

Option A. In route tags

```vue
<template>
    <!-- content -->
</template>

<route>
  { meta: { layout: 'fullscreen' } }
</route>

<script setup lang="ts">
    // script
</script>
```

Option B. In script

```vue
<template>
    <!-- content -->
</template>

<route>
  { meta: { layout: 'fullscreen' } }
</route>

<script setup lang="ts">
definePage({
  meta: {
    layout: 'fullscreen',
  },
})
    // script
</script>
```

4. Test

Now, when navigating through pages, sandbox will have no 'Welcome' header as it uses fullscreen layout.
