import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, watch } from 'vue'
import { useTheme } from 'vuetify'

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const setTheme = useTheme()

    const theme = ref(setTheme.global.current.value.dark ? 'dark' : 'light')

    watch(theme, (newTheme) => {
      setTheme.change(newTheme)
    })

    function themeToggle() {
      theme.value = theme.value === 'light' ? 'dark' : 'light'
      setTheme.change(theme.value)
    }

    return { theme, themeToggle }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['theme'],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
