# Application Features

## Overview

This section will guide through creating a set of core features and a default layout, resulting in complete and reusable web application.

- **default layout** with app bar, navigation bar and footer with version information.

- **settings** theme, language, font size.

- **navigation** helpers - menu, breadcrumbs

- **a11y enhancements** - dynamic page title, skip link, route announcer, focus management

- **UI capabilities** - alerts, snack-bars, loading.

- **page not found** implementation.

## Default Layout

1. Update title and replace `./apps/public/favicon.ico` 

#### `./apps/index.html`

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

2. Clean the main App to have just wrapper for layouts

#### `@/App.vue`

```vue
<template>
  <component :is="LayoutComponent">
    <RouterView />
  </component>
</template>

<script setup lang="ts">
//
</script>
```

3. Add title to json package

#### `./apps/package.json`

```json
{
  "name": "odbvue",
  "title" : "OdbVue",
  // ...
```

4. Modify default layout

Add logo `./apps/public/logo.sv` and change default layout.

#### `@/layouts/DefaultLayout.vue`

```vue
<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-container>
        <v-row>
          <v-col cols="4">
            <v-img eager class="rounded-lg border-thin" :alt="title" src="./logo.svg"> </v-img>
          </v-col>
        </v-row>
      </v-container>
      <v-divider />
      <v-list>
        <v-list-item
          v-for="page in pages"
          :key="page.path"
          :prepend-icon="page.icon || '$mdiMinus'"
          :to="page.path"
        >
          <v-list-item-title>{{ page.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>{{ title }}</v-toolbar-title>
    </v-app-bar>
    <v-main class="ma-4">
      <slot />
    </v-main>
    <v-footer app>
      <v-row>
        <v-col> {{ version }} </v-col>
        <v-col class="text-right">
          <v-btn
            icon
            href="https://github.com/odbvue/odbvue"
            target="_blank"
            rel="noopener"
            title="GitHub"
            size="xx-small"
            color="secondary"
            variant="flat"
          >
            <v-icon icon="$mdiGithub"></v-icon>
          </v-btn>
        </v-col>
      </v-row>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
import { version, title } from '../../package.json'
const drawer = ref(false)
const pages = ref([
  { title: 'Home', icon: '$mdiHome', path: '/' },
  { title: 'About', icon: '$mdiInformation', path: '/about' },
  { title: 'Sandbox', icon: '$mdiCog', path: '/sandbox' },
])
</script>
```