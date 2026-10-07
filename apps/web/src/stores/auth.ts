import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, watch } from 'vue'
import { useAuth, useUi } from '@odbvue/web'

export const useAuthStore = defineStore('auth', () => {
  const auth = useAuth()
  const ui = useUi()
  let initialization: Promise<void> | undefined

  function init(): Promise<void> {
    initialization ??= auth.ready.value
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const stop = watch(auth.ready, (ready) => {
            if (ready) {
              stop()
              resolve()
            }
          })
        })
    return initialization
  }

  async function login(username: string, password: string): Promise<boolean> {
    await init()
    ui.clear()
    try {
      await auth.login({ username, password })
      return true
    } catch (error) {
      const status = error instanceof Error && 'status' in error ? error.status : undefined
      if (status === 401) ui.error('auth.invalid.credentials')
      else if (status === 403) ui.error('auth.forbidden')
      else if (status === 429) ui.error('auth.too.many.requests')
      else ui.error(error)
      return false
    }
  }

  async function logout(): Promise<boolean> {
    await init()
    ui.clear()
    try {
      await auth.logout()
      return true
    } catch (error) {
      ui.error(error)
      return false
    }
  }

  return {
    user: computed(() => auth.user.value),
    accessToken: computed(() => auth.accessToken.value),
    isAuthenticated: computed(() => auth.authenticated.value),
    ready: computed(() => auth.ready.value),
    loading: computed(() => auth.loading.value),
    init,
    login,
    logout,
    refresh: () => auth.refresh(),
    restore: () => auth.restore(),
    me: () => auth.me(),
    hasRole: (role: string) => auth.hasRole(role),
    can: (permission: string) => auth.can(permission),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
