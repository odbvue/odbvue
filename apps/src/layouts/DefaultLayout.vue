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
          v-for="page in app.navigation.pages"
          :key="page.path"
          :prepend-icon="page.icon"
          :to="page.path"
        >
          <v-list-item-title>{{ page.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
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
    <v-main class="ma-4" id="main" tabindex="-1">
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
      <a class="skip-link" href="#main" @click.prevent="focusMain">Skip to content</a>
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
const { mobile } = useDisplay()
const app = useAppStore()
const drawer = ref(false)

function focusMain() {
  const el = document.getElementById('main')
  if (el) {
    el.focus({ preventScroll: true })
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<style scoped>
.skip-link {
  position: absolute;
  left: 0.5rem; top: 0.5rem;
  padding: .5rem .75rem;
  background: white;
  border-radius: .375rem;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
  transform: translateY(-150%);
  transition: transform .15s ease;
  z-index: 1000;
}
.skip-link:focus {
  transform: translateY(0);
}
</style>