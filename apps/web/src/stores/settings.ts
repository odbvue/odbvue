import { defineStore, acceptHMRUpdate } from 'pinia'

import { computed, ref, type Ref, watch } from 'vue'

import { getOdbVueI18n, getOdbVueVuetify } from '@odbvue/web'

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
        void getOdbVueVuetify().theme.change(nextTheme)
      },
      { immediate: true },
    )

    const i18nManager = getOdbVueI18n().global as {
      locale: Ref<string>
      availableLocales: string[]
    }

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
