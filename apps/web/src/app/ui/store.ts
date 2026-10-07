import { defineStore, acceptHMRUpdate, storeToRefs } from 'pinia'
import { ref, computed, readonly } from 'vue'

export interface AlertOptions {
  timeout?: number
}

export type UiNotificationType = 'info' | 'success' | 'warning' | 'error'

export interface UiNotification {
  type: UiNotificationType
  message: string
  timeout?: number
  presentation: 'alert' | 'snackbar'
}

const useUiStore = defineStore('ui', () => {
  const loading = ref(false)
  const notification = ref<UiNotification | undefined>(undefined)
  const snackbar = computed(() => notification.value?.presentation === 'snackbar')
  const activeAlertTimeout = ref<number | undefined>(undefined)

  function clearActiveAlert() {
    notification.value = undefined
    if (activeAlertTimeout.value !== undefined) {
      clearTimeout(activeAlertTimeout.value)
      activeAlertTimeout.value = undefined
    }
  }

  function clearAll() {
    clearActiveAlert()
  }

  function scheduleAlertClear(timeout: number) {
    if (activeAlertTimeout.value !== undefined) {
      clearTimeout(activeAlertTimeout.value)
    }

    if (timeout > 0) {
      activeAlertTimeout.value = window.setTimeout(() => {
        clearActiveAlert()
        activeAlertTimeout.value = undefined
      }, timeout)
    }
  }

  function show(
    type: UiNotificationType,
    message: string,
    presentation: UiNotification['presentation'],
    options: AlertOptions = {},
  ) {
    clearAll()
    notification.value = { type, message, timeout: options.timeout, presentation }
    scheduleAlertClear(options.timeout ?? 0)
  }

  function startLoading() {
    loading.value = true
  }

  function stopLoading() {
    loading.value = false
  }

  return {
    loading,
    notification,
    snackbar,
    clearAll,
    show,
    startLoading,
    stopLoading,
  }
})

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Provides OdbVue's application-facing feedback API. */
export function useUi() {
  const store = useUiStore()
  const { loading, notification, snackbar } = storeToRefs(store)

  return {
    loading: readonly(loading),
    notification: readonly(notification),
    snackbar: readonly(snackbar),
    clear: store.clearAll,
    info: (message: string, options?: AlertOptions) =>
      store.show('info', message, 'alert', options),
    success: (message: string, options?: AlertOptions) =>
      store.show('success', message, 'alert', options),
    warning: (message: string, options?: AlertOptions) =>
      store.show('warning', message, 'alert', options),
    error: (error: unknown, options?: AlertOptions) =>
      store.show('error', messageFrom(error), 'alert', options),
    snack: (message: string, options?: AlertOptions) =>
      store.show('info', message, 'snackbar', options),
    startLoading: store.startLoading,
    stopLoading: store.stopLoading,
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
