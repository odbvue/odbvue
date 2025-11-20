import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const themeManager = useTheme()
    const themes = computed(() => Object.keys(themeManager.themes.value))
    const theme = ref(themeManager.global.name.value)
    const themeIcon = computed(() => {
      if (themeManager.global.name.value === 'light') return '$mdiWeatherNight'
      if (themeManager.global.name.value === 'dark') return '$mdiWeatherSunny'
      return ''
    })
    function toggleTheme() {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
    }
    watch(theme, (newTheme) => {
      if (!themes.value.includes(newTheme)) {
        console.warn(`[Settings Store] Invalid theme: ${newTheme}`)
        const firstTheme = themes.value[0]
        if (firstTheme) {
          theme.value = firstTheme
        }
        return
      }
      themeManager.change(newTheme)
    })

    const i18nManager = useI18n()
    const locale = ref(i18nManager.locale.value)
    const locales = ref(i18nManager.availableLocales)
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

    return {
      theme,
      themes,
      themeIcon,
      toggleTheme,
      locale,
      locales,
      setLocale,
      fontSize,
      fontSizes,
      setFontSize,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['locale', 'theme', 'fontSize'],
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
