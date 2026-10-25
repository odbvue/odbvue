import { defineStore, acceptHMRUpdate, storeToRefs, type Pinia } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { pinia } from '../state'
import { createLoading } from './loading'

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
  const loading = createLoading()
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

  return {
    loadingCounts: loading.counts,
    loadingActive: loading.active,
    isLoading: loading.has,
    startLoading: loading.start,
    runLoading: loading.run,
    notification,
    snackbar,
    clearAll,
    show,
  }
})

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Provides OdbVue's application-facing feedback API. */
export function useUi(state: Pinia = pinia) {
  const store = useUiStore(state)
  const { loadingActive, notification, snackbar } = storeToRefs(store)

  return {
    loading: {
      active: readonly(loadingActive),
      has: store.isLoading,
      start: store.startLoading,
      run: store.runLoading,
    },
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
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
