import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'

export function useNotificationMessage(message: MaybeRefOrGetter<string | undefined>) {
  const i18n = useI18n()

  return computed(() => {
    const value = toValue(message) ?? ''
    const isTranslationKey = i18n.availableLocales.some((locale) => i18n.te(value, locale))
    return isTranslationKey ? i18n.t(value) : value
  })
}

export function useCardBackground(color: string) {
  const theme = useTheme()

  return computed(() => {
    const dark = theme.current.value.dark
    const grFrom = dark ? '33' : '66'
    const grTo = dark ? '66' : '33'

    return {
      background: `linear-gradient(135deg, ${color}${grFrom} 33%, ${color}${grTo} 100%)`,
    }
  })
}
