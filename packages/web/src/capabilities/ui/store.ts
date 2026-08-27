import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed } from 'vue'

export interface AlertOptions {
  timeout?: number
  onRouteChange?: 'keep' | 'clear'
}

export const useUiStore = defineStore('ui', () => {
  const loading = ref(false)
  const info = ref('')
  const success = ref('')
  const warning = ref('')
  const error = ref('')
  const snack = ref('')
  const snackTimeout = ref(0)
  const snackbar = computed(() => !!snack.value)
  const activeAlertTimeout = ref<number | undefined>(undefined)
  const routeChangeBehavior = ref<'keep' | 'clear'>('keep')

  function clearActiveAlert() {
    info.value = ''
    success.value = ''
    warning.value = ''
    error.value = ''
    snack.value = ''
    snackTimeout.value = 0
    if (activeAlertTimeout.value !== undefined) {
      clearTimeout(activeAlertTimeout.value)
      activeAlertTimeout.value = undefined
    }
    routeChangeBehavior.value = 'keep'
  }

  function clearAll() {
    clearActiveAlert()
  }

  function clearAlertForRouteChange() {
    if (routeChangeBehavior.value !== 'clear') {
      return
    }

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

  function setAlertBehavior(options: AlertOptions = {}) {
    routeChangeBehavior.value = options.onRouteChange ?? 'keep'
  }

  function setInfo(message: string, options: AlertOptions = {}) {
    clearAll()
    info.value = message
    setAlertBehavior(options)
    scheduleAlertClear(options.timeout ?? 0)
  }

  function setSuccess(message: string, options: AlertOptions = {}) {
    clearAll()
    success.value = message
    setAlertBehavior(options)
    scheduleAlertClear(options.timeout ?? 0)
  }

  function setWarning(message: string, options: AlertOptions = {}) {
    clearAll()
    warning.value = message
    setAlertBehavior(options)
    scheduleAlertClear(options.timeout ?? 0)
  }

  function setError(message: string, options: AlertOptions = {}) {
    clearAll()
    error.value = message
    setAlertBehavior(options)
    scheduleAlertClear(options.timeout ?? 0)
  }

  function setSnack(message: string, options: AlertOptions = {}) {
    clearAll()
    snack.value = message
    snackTimeout.value = options.timeout ?? 0
    setAlertBehavior(options)
    if ((options.timeout ?? 0) > 0) {
      scheduleAlertClear(options.timeout ?? 0)
    } else if (activeAlertTimeout.value !== undefined) {
      clearTimeout(activeAlertTimeout.value)
      activeAlertTimeout.value = undefined
    }
  }

  function startLoading() {
    loading.value = true
  }

  function stopLoading() {
    loading.value = false
  }

  return {
    loading,
    info,
    success,
    warning,
    error,
    snack,
    snackTimeout,
    snackbar,
    clearAll,
    clearAlertForRouteChange,
    setInfo,
    setSuccess,
    setWarning,
    setError,
    setSnack,
    startLoading,
    stopLoading,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
