import { defineStore, acceptHMRUpdate } from 'pinia'

import { ref, watch } from 'vue'

import vuetify from '@/plugins/vuetify'

const themes = ['system', 'light', 'dark'] as const

type ThemeName = (typeof themes)[number]

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const theme = ref<ThemeName>('system')

    watch(
      theme,
      (nextTheme) => {
        void vuetify.theme.change(nextTheme)
      },
      { immediate: true },
    )

    function setTheme(nextTheme: ThemeName) {
      theme.value = nextTheme
    }

    function toggleTheme() {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
    }

    return { theme, themes, setTheme, toggleTheme }
  },
  {
    persist: {
      storage: 'localStorage',
      paths: ['theme'],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
