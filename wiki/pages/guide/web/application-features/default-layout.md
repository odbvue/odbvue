# Default Layout

## App

The main `apps\web\src\app\App.vue` wraps pages in the selected application layout.

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

## Default Layout

Modify default layout to have app layout with navigation drawer, app bar and footer.

For signed-in users, the navigation drawer and app-bar account menu provide
separate Settings and Logout entries. Settings uses a cog icon in both menus;
the app-bar menu activator retains the user's avatar. The drawer displays a non-clickable avatar
and full name above these menu items. Avatars use Vuetify's standard `v-avatar`
and `v-img`, with initials when no image is available or the image fails to load.
Settings opens `/settings`, which defaults to the Account section at
`/settings/account`. Settings is available from the identity menu and drawer,
not as a home-page widget. Account is the only implemented section; Appearance
(`/settings/appearance`), Language & region (`/settings/language`) and Notifications
(`/settings/notifications`) can be added as sibling pages later. These unimplemented
sections are not shown as navigation links. Legacy `/account` links redirect to
the new Account page while retaining query parameters and the hash.
The active Account tab labels its content, without a duplicate Account heading below it.
The Account page uses the same Vuetify components;
capabilities contain no Vue components.

Logout is disabled during authentication activity, closes the navigation drawer,
and returns to the home page. Anonymous users see Login instead.

::: details `apps\web\src\app\layouts\DefaultLayout.vue`

```vue
<template>
  <v-app>
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
    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>OdbVue</v-toolbar-title>
    </v-app-bar>
    <v-main class="ma-4">
      <slot />
    </v-main>
    <v-footer app>
      <v-row>
        <v-col>
          <span class="text-caption">v1.0.0</span>
        </v-col>
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
const drawer = ref(false)
const routing = useRouting()
</script>
```

:::
