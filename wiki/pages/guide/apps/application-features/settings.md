# Settings

1. Add font-size and language to Settings Store

::: details `apps\web\src\stores\settings.ts`

```ts
import { defineStore, acceptHMRUpdate } from 'pinia'

import { computed, ref, watch } from 'vue'

import i18n from '@/plugins/i18n'
import vuetify from '@/plugins/vuetify'

const themes = ['system', 'light', 'dark'] as const

type ThemeName = (typeof themes)[number]

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const theme = ref<ThemeName>('system')

    function setTheme(nextTheme: ThemeName) {
      theme.value = nextTheme
    }

    function toggleTheme() {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
    }

    const themeIcon = computed(() => {
      return theme.value === 'light' ? '$mdiWeatherSunny' : '$mdiWeatherNight'
    })

    watch(
      theme,
      (nextTheme) => {
        void vuetify.theme.change(nextTheme)
      },
      { immediate: true },
    )

    const i18nManager = i18n.global

    const locale = ref(i18nManager.locale.value)

    const locales = computed(() => i18nManager.availableLocales)

    function setLocale(newLocale: string) {
      locale.value = newLocale
    }

    watch(locale, (newLocale) => {
      if (!locales.value.includes(newLocale)) {
        console.warn(`[Settings Store] Invalid locale: ${newLocale}`)
        const firstLocale = locales.value[0]
        if (firstLocale) {
          locale.value = firstLocale
        }
        return
      }
      i18nManager.locale.value = newLocale
    })

    const fontSize = ref(100)

    const fontSizes = [100, 150, 200]

    function setFontSize(newFontSize: number) {
      if (!fontSizes.includes(newFontSize)) {
        console.warn(`[Settings Store] Invalid font size: ${newFontSize}`)
        fontSize.value = 100
        return
      }
      fontSize.value = newFontSize
      if (typeof document !== 'undefined') {
        document.documentElement.style.fontSize = `${newFontSize}%`
      }
    }

    watch(fontSize, (newFontSize) => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.fontSize = `${newFontSize}%`
      }
    })

    return {
      theme,
      themes,
      setTheme,
      toggleTheme,
      themeIcon,
      locale,
      locales,
      setLocale,
      fontSize,
      fontSizes,
      setFontSize,
    }
  },
  {
    persist: {
      storage: 'localStorage',
      paths: ['theme', 'locale', 'fontSize'],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
```

:::

2. Add settings switches to Default Layout.

::: details `apps\web\src\layouts\DefaultLayout.vue`

```vue
<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
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
      <v-toolbar-title>{{ app.title }}</v-toolbar-title>
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
            <v-list-item @click="app.settings.toggleTheme()">
              <v-list-item-title>
                <v-icon class="ml-10" :icon="app.settings.themeIcon"></v-icon>
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
        data-cy="theme-toggle"
      ></v-btn>
    </v-app-bar>
    <v-main class="ma-4">
      <slot />
    </v-main>
    <v-footer app>
      <v-row>
        <v-col>
          <span class="text-caption">v{{ app.version }}</span>
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
const app = useAppStore()
const { mobile } = useDisplay()

const pages = ref([
  { title: 'Home', icon: '$mdiHome', path: '/' },
  { title: 'About', icon: '$mdiInformation', path: '/about' },
  { title: 'Sandbox', icon: '$mdiCog', path: '/sandbox' },
])
</script>
```

:::
