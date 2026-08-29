# Navigation

Navigation is derived from the routing capability. It is not a Pinia store: generated Vue Router routes are collected into the canonical OdbVue page manifest, and `useRouting()` exposes the page and breadcrumb views needed by application UI.

## Navigation Drawer

`routing.pages` contains navigable root-level pages, excludes catch-all routes, and is ordered by navigation order then path. Page display metadata remains under `page.meta`. An application shell can exclude module-owned pages with `page.module === undefined`.

```vue
<template>
  <v-navigation-drawer v-model="drawer" app>
    <v-list>
      <v-list-item
        v-for="page in routing.pages.value"
        :key="page.path"
        :prepend-icon="page.meta.icon || '$mdiMinus'"
        :to="page.path"
      >
        <v-list-item-title>{{ page.title }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
const drawer = ref(false)
const routing = useRouting()
</script>
```

## Breadcrumbs

`routing.breadcrumbs` follows the current matched route hierarchy and omits pages with `visibility: 'never'`.

```vue
<template>
  <v-breadcrumbs :items="routing.breadcrumbs.value">
    <template #divider>
      <v-icon icon="$mdiChevronRight" />
    </template>
  </v-breadcrumbs>
</template>

<script setup lang="ts">
const routing = useRouting()
</script>
```

For a dynamic final breadcrumb, such as a customer name, use the routing runtime:

```ts
const routing = useRouting()
routing.setBreadcrumb('Acme Corp')
```

## Page Metadata

Declare page metadata with `definePage()`. `navigation: false`, `hidden: true`, and `visibility: 'never'` remove a page from `routing.pages`.

```ts
definePage({
  meta: {
    title: 'Customer administration',
    description: 'Search and maintain customers.',
    icon: '$mdiAccountGroup',
    navigation: { label: 'Customers', order: 20 },
  },
})
```

Use `routing.navigate()` for programmatic navigation, and `routing.params` for normalized path and query parameters.