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

::: details source
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
:::

## Settings

1. Create new main Application store - container for all application level stores

#### `@/stores/index.ts`

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()

  return { settings: getSettings() }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
```

2. Enhance Settings store with locale and size capabilities

#### `@/stores/settings.ts`

::: details source
<<<../../../src/stores/settings.ts
:::

3. Add Setting capabilities im application 

#### `@/layouts/DefaultLayout.vue`

::: details source
```vue
<template>
    <!-- -->
    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>{{ title }}</v-toolbar-title>
      <v-btn v-if="mobile">
        <v-icon :icon="'$mdiDotsVertical'"></v-icon>
        <v-menu activator="parent">
          <v-list>
            <v-list-item link prepend-icon="$mdiMenuLeft">
              <v-list-item-title>
                <v-icon icon="$mdiEyePlusOutline"></v-icon>
              </v-list-item-title>
              <v-menu submenu activator="parent">
                <v-list>
                  <v-list-item
                    link
                    v-for="item in app.settings.fontSizes"
                    :key="item"
                    :value="item"
                    @click="app.settings.setFontSize(item)"
                  >
                    <v-list-item-title> {{ item }}% </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-list-item>
            <v-list-item link prepend-icon="$mdiMenuLeft">
              <v-list-item-title>
                {{ app.settings.locale }}
              </v-list-item-title>
              <v-menu submenu activator="parent">
                <v-list>
                  <v-list-item
                    link
                    v-for="item in app.settings.locales"
                    :key="item"
                    :value="item"
                    @click="app.settings.setLocale(item)"
                  >
                    <v-list-item-title>
                      {{ item }}
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-list-item>
            <v-list-item
              link
              prepend-icon="app.settings.themeIcon"
              @click="app.settings.toggleTheme()"
            >
              <v-list-item-title>
                <v-icon :icon="app.settings.themeIcon"></v-icon>
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-btn>
      <v-menu v-if="!mobile">
        <template #activator="{ props }">
          <v-btn variant="text" v-bind="props" prepend-icon="$mdiEyePlusOutline"></v-btn>
        </template>
        <v-list>
          <v-list-item v-for="(item, i) in app.settings.fontSizes" :key="i" :value="i">
            <v-list-item-title @click="app.settings.setFontSize(item)"
              >{{ item }}%</v-list-item-title
            >
          </v-list-item>
        </v-list>
      </v-menu>
      <v-menu v-if="!mobile">
        <template #activator="{ props }">
          <v-btn variant="text" v-bind="props">{{ app.settings.locale }}</v-btn>
        </template>
        <v-list>
          <v-list-item v-for="(item, i) in app.settings.locales" :key="i" :value="i">
            <v-list-item-title @click="app.settings.setLocale(item)">{{ item }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-btn
        v-if="!mobile"
        variant="text"
        :prepend-icon="app.settings.themeIcon"
        @click="app.settings.toggleTheme()"
      ></v-btn>
    </v-app-bar>
    <!-- -->
</template>

<script setup lang="ts">
// ..
const { mobile } = useDisplay()
const app = useAppStore()
// ..
</script>
```
:::

## Navigation

1. Create a new store for populating navigation menu and breadcrumbs.

#### `@/stores/navigation.ts `

::: details source
```ts
import { defineStore, acceptHMRUpdate } from 'pinia'
import { useRouter, useRoute } from 'vue-router'

export const useNavigationStore = defineStore('navigation', () => {
  const routes = useRouter().getRoutes()
  const route = useRoute()

  const allPages = routes.map((route) => {
    return {
      path: route.path,
      level: route.path == '/' ? 0 : route.path.split('/').length - 1,
      children:
        routes.find((r) => r.path.includes(route.path) && r.path !== route.path) !== undefined,
      title:
        route.meta?.title?.toString() ||
        route.path
          .split('/')
          .at(-1)
          ?.split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ') ||
        '',
      description: route.meta?.description?.toString() || '',
      icon: (route.meta?.icon as string) || '$mdiMinus',
      color: (route.meta?.color as string) || '',
      role: (route.meta?.role as string) || '',
    }
  })

  const title = computed(() => (path: string) => {
    const page = allPages.find((page) => page.path === path)
    return page ? page.title : ''
  })

  const breadcrumbs = computed(() => {
    const paths = ['', ...route.path.split('/').filter(Boolean)].map((_, i, arr) => {
      const path = arr.slice(1, i + 1).join('/')
      return '/' + path
    })
    const crumbs = allPages
      .filter((page) => page.path !== '/:path(.*)')
      .filter((page) => paths.includes(page.path))
      .sort((a, b) => a.level - b.level)
      .map((page) => {
        return {
          title: page.title,
          disabled: route.path === page.path,
          href: page.path,
          icon: page.icon,
        }
      })
    return crumbs
  })

  const pages = computed(() => {
    return allPages.filter((page) => page.level < 2).filter((page) => page.path !== '/:path(.*)')
  })

  return {
    pages,
    title,
    breadcrumbs,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNavigationStore, import.meta.hot))
}
```
:::

2. Add navigation store to main store

#### `@/stores/index.ts`

```ts{5,7,12}
import { defineStore, acceptHMRUpdate } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()
  const getNavigation = () => useNavigationStore()

  return { settings: getSettings(), navigation: getNavigation() }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
  import.meta.hot.accept(acceptHMRUpdate(useNavigationStore, import.meta.hot))
}
```

3. Add Breadcrumbs and Menu to Default Layout.

#### `@/layots/DefaultLayout.vue`

```vue{5,16-26}
</template>
    <!-- -->
      <v-list>
        <v-list-item
          v-for="page in app.navigation.pages"
          :key="page.path"
          :prepend-icon="page.icon"
          :to="page.path"
        >
          <v-list-item-title>{{ page.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <!-- -->
    <v-main class="ma-4">
      <v-breadcrumbs :items="app.navigation.breadcrumbs">
        <template v-slot:title="{ item, index }">
          <v-breadcrumbs-item
            v-if="index !== app.navigation.breadcrumbs.length - 1"
            :to="item.href"
          >
            {{ item.title }}
          </v-breadcrumbs-item>
          <v-breadcrumbs-item v-else>{{ item.title }}</v-breadcrumbs-item>
        </template>
      </v-breadcrumbs>
      <slot />
    </v-main>
    <!-- -->
</template>

<script setup lang="ts">
import { version, title } from '../../package.json'
const { mobile } = useDisplay()
const app = useAppStore()
const drawer = ref(false)
const pages = ref([ // [!code --]
  { title: 'Home', icon: '$mdiHome', path: '/' }, // [!code --]
  { title: 'About', icon: '$mdiInformation', path: '/about' }, // [!code --]
  { title: 'Sandbox', icon: '$mdiCog', path: '/sandbox' }, // [!code --]
]) // [!code --]
</script>    
```

4. Enhance Home view with cards representing pages.

#### `@/pages/index.vue`

::: details source
```vue
<template>
  <h1>Home</h1>
  <v-row>
    <v-col
      cols="12"
      md="4"
      v-for="page in app.navigation.pages.filter((page) => page.path !== '/')"
      :key="page.path"
    >
      <v-card
        min-height="8em"
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
    title: 'Welcome Home',
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
