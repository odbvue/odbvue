import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'
import type { VSnackbarQueue } from 'vuetify/components'
import { useUi } from './store'

export function useNotificationQueue(ui = useUi()) {
  const snackbarQueue = ref<InstanceType<typeof VSnackbarQueue>>()
  const ready = ref(false)
  const messages = computed({
    get: () => (ready.value ? ui.notificationQueue.value : []),
    set: (remaining) => {
      ui.notificationQueue.value = remaining
    },
  })

  // Vuetify starts processing on model changes, not an initially populated model.
  onMounted(() => {
    ready.value = true
  })
  onBeforeUnmount(ui.resetNotificationQueue)
  watch(ui.notificationClearVersion, () => snackbarQueue.value?.clear())

  return { messages, snackbarQueue }
}

export function useNotificationMessage(message: MaybeRefOrGetter<string | undefined>) {
  const translate = useNotificationTranslator()
  return computed(() => translate(toValue(message)))
}

export function useNotificationTranslator() {
  const i18n = useI18n()

  return (message?: string) => {
    const value = message ?? ''
    const isTranslationKey = i18n.availableLocales.some((locale) => i18n.te(value, locale))
    return isTranslationKey ? i18n.t(value) : value
  }
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
