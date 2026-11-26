import { defineStore, acceptHMRUpdate, storeToRefs, type Pinia } from 'pinia'
import { ref, computed, readonly, onScopeDispose } from 'vue'
import { pinia } from '../state'
import { createLoading } from './loading'
import { errorMessage, mutationError } from './mutation-error'
import type { HttpResponse } from '../http/core'
import { i18n } from '../i18n'
import type { OvActionComplete } from '@/components/api'

export interface AlertOptions {
  timeout?: number
}

export type UiNotificationType = 'info' | 'success' | 'warning' | 'error'

export interface UiAlertOptions extends AlertOptions {
  type?: UiNotificationType
}

export type UiActionResult<T> = { ok: true; data: T } | { ok: false; error: unknown }

export interface UiNotification {
  id: number
  pending: boolean
  type: UiNotificationType
  message: string
  timeout?: number
  presentation: 'alert' | 'snackbar'
}

export interface UiSnackbarMessage {
  id: string
  text: string
  color: UiNotificationType
  timeout: number
  onDismiss: () => void
}

const useUiStore = defineStore('ui', () => {
  const loading = createLoading()
  const loadingOverlayCount = ref(0)
  const loadingGlobal = computed(() => loading.active.value && loadingOverlayCount.value === 0)
  const notifications = ref<UiNotification[]>([])
  const nextNotificationId = ref(0)
  const notificationClearVersion = ref(0)
  let alertTimer: ReturnType<typeof setTimeout> | undefined
  const notification = computed(
    () =>
      notifications.value.findLast((item) => item.presentation === 'alert') ??
      notifications.value.at(-1),
  )
  const snackbar = computed(() => notification.value?.presentation === 'snackbar')
  const notificationQueue = computed<UiSnackbarMessage[]>({
    get: () =>
      notifications.value
        .filter((item) => item.presentation === 'snackbar' && item.pending)
        .map((item) => ({
          id: String(item.id),
          text: item.message,
          color: item.type,
          timeout: item.timeout === 0 ? -1 : (item.timeout ?? 5000),
          onDismiss: () => dismiss(item.id),
        })),
    set: (remaining) => {
      const ids = new Set(remaining.map((item) => item.id))
      for (const item of notifications.value) {
        if (item.pending && !ids.has(String(item.id))) item.pending = false
      }
    },
  })

  function registerLoadingOverlay() {
    loadingOverlayCount.value++
    let released = false
    return () => {
      if (released) return
      released = true
      loadingOverlayCount.value--
    }
  }

  function cancelAlertTimer() {
    if (alertTimer !== undefined) clearTimeout(alertTimer)
    alertTimer = undefined
  }
  onScopeDispose(cancelAlertTimer)

  function clearAlert() {
    cancelAlertTimer()
    notifications.value = notifications.value.filter((item) => item.presentation !== 'alert')
  }

  function clearSnackbars() {
    notifications.value = notifications.value.filter((item) => item.presentation !== 'snackbar')
    notificationClearVersion.value++
  }

  function clearAll() {
    clearAlert()
    clearSnackbars()
  }

  function resetNotificationQueue() {
    for (const item of notifications.value) {
      if (item.presentation === 'snackbar') item.pending = true
    }
  }

  function dismiss(id: number) {
    const target = notifications.value.find((item) => item.id === id)
    if (!target) return
    if (target.presentation === 'alert') cancelAlertTimer()
    notifications.value = notifications.value.filter((item) => item.id !== id)
  }

  function show(
    type: UiNotificationType,
    message: string,
    options: AlertOptions = {},
    presentation: UiNotification['presentation'] = 'snackbar',
  ) {
    if (presentation === 'alert') clearAlert()
    const timeout = options.timeout ?? (presentation === 'alert' ? 0 : 5000)
    const item: UiNotification = {
      id: nextNotificationId.value++,
      pending: presentation === 'snackbar',
      type,
      message,
      timeout,
      presentation,
    }
    notifications.value = [...notifications.value, item]
    if (presentation === 'alert' && timeout > 0) {
      alertTimer = setTimeout(() => dismiss(item.id), timeout)
    }
  }

  return {
    loadingCounts: loading.counts,
    loadingActive: loading.active,
    loadingOverlayCount,
    loadingGlobal,
    registerLoadingOverlay,
    isLoading: loading.has,
    startLoading: loading.start,
    runLoading: loading.run,
    notification,
    notifications,
    nextNotificationId,
    notificationQueue,
    notificationClearVersion,
    resetNotificationQueue,
    snackbar,
    clearAlert,
    clearSnackbars,
    clearAll,
    dismiss,
    show,
  }
})

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Provides OdbVue's application-facing feedback API. */
export function useUi(state: Pinia = pinia) {
  const store = useUiStore(state)
  const {
    loadingActive,
    loadingGlobal,
    notification,
    notifications,
    notificationQueue,
    notificationClearVersion,
    snackbar,
  } = storeToRefs(store)

  return {
    loading: {
      active: readonly(loadingActive),
      global: readonly(loadingGlobal),
      registerOverlay: store.registerLoadingOverlay,
      has: store.isLoading,
      start: store.startLoading,
      run: store.runLoading,
    },
    notification: readonly(notification),
    notifications: readonly(notifications),
    notificationQueue,
    notificationClearVersion: readonly(notificationClearVersion),
    resetNotificationQueue: store.resetNotificationQueue,
    snackbar: readonly(snackbar),
    clear: store.clearAll,
    clearAlert: store.clearAlert,
    clearSnackbars: store.clearSnackbars,
    dismiss: store.dismiss,
    alert: (message: string, options: UiAlertOptions = {}) =>
      store.show(options.type ?? 'info', message, options, 'alert'),
    /** Runs an action with named loading and error notification; check ok before using data. */
    action: async <T>(key: string, action: () => T | Promise<T>): Promise<UiActionResult<T>> => {
      try {
        return { ok: true, data: await store.runLoading(key, action) }
      } catch (error) {
        store.show('error', errorMessage(error))
        return { ok: false, error }
      }
    },
    mutation: async <T>(
      key: string,
      operation: () => Promise<HttpResponse<T>>,
      complete: OvActionComplete,
      success?: string,
    ): Promise<void> => {
      const response = await store.runLoading(key, operation).then(
        (result) => result,
        (error: unknown) =>
          ({ data: null, error, status: null, headers: null }) as HttpResponse<T>,
      )
      if (response.error) {
        complete(mutationError(response.error, (message) => store.show('error', message)))
        return
      }
      if (response.status && response.status >= 400) {
        complete({ status: 'error' })
        store.show('error', i18n.global.t('errors.requestFailed'))
        return
      }
      if (response.status === null) {
        complete({ status: 'error' })
        store.show('error', i18n.global.t('errors.requestFailed'))
        return
      }
      complete({ status: 'success', refetch: true })
      if (success) store.show('success', success)
    },
    info: (message: string, options?: AlertOptions) => store.show('info', message, options),
    success: (message: string, options?: AlertOptions) => store.show('success', message, options),
    warning: (message: string, options?: AlertOptions) => store.show('warning', message, options),
    error: (error: unknown, options?: AlertOptions) =>
      store.show('error', messageFrom(error), options),
    mutationError: (error: unknown) =>
      mutationError(error, (message) => store.show('error', message)),
    snack: (message: string, options?: AlertOptions) => store.show('info', message, options),
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
