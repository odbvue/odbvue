import { onScopeDispose, readonly, ref } from 'vue'

export interface NetworkStatus {
  online: Readonly<ReturnType<typeof ref<boolean>>>
  lastOnlineAt: Readonly<ReturnType<typeof ref<Date | null>>>
  lastOfflineAt: Readonly<ReturnType<typeof ref<Date | null>>>
}

/** Tracks browser-reported connectivity; online does not guarantee API reachability. */
export function useNetwork(): NetworkStatus {
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  const lastOnlineAt = ref<Date | null>(online.value ? new Date() : null)
  const lastOfflineAt = ref<Date | null>(online.value ? null : new Date())
  const setOnline = () => {
    online.value = true
    lastOnlineAt.value = new Date()
  }
  const setOffline = () => {
    online.value = false
    lastOfflineAt.value = new Date()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', setOnline)
    window.addEventListener('offline', setOffline)
    onScopeDispose(() => {
      window.removeEventListener('online', setOnline)
      window.removeEventListener('offline', setOffline)
    })
  }

  return {
    online: readonly(online),
    lastOnlineAt: readonly(lastOnlineAt),
    lastOfflineAt: readonly(lastOfflineAt),
  }
}
