# Application Features

## Overview

This section will guide through creating a set of core features and a default layout, resulting in complete and reusable web application.

- **page not found** implementation.

- dnd


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
