import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'
import { useAppStore as useRuntimeAppStore } from '@odbvue/web'
import { useAuthStore } from './auth'

export const useAppStore = defineStore('main', () => {
  const runtime = useRuntimeAppStore()
  const auth = useAuthStore()

  return {
    title: computed(() => runtime.title),
    version: computed(() => runtime.version),
    preferences: runtime.preferences,
    ui: runtime.ui,
    auth,
    user: computed(() => auth.user),
    init: () => auth.init(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
