import type { Ref } from 'vue'
import type { Auth, AuthContext, AuthUser, LoginResponse } from './types.js'

export function createSession<User extends AuthUser>(
  context: AuthContext<User>,
  ready: Ref<boolean>,
  loadConfig: () => Promise<void>,
): Pick<Auth<User>, 'login' | 'refresh' | 'logout' | 'restore'> {
  let restorePromise: Promise<boolean> | undefined
  let refreshPromise: Promise<boolean> | undefined
  const { http, endpoints, beginOperation, applyToken, clear, refreshUser } = context

  function refresh(): Promise<boolean> {
    refreshPromise ??= (async () => {
      const finish = beginOperation('auth.refresh')
      try {
        const response = await http().post<{ accessToken: string }>(endpoints.refresh, undefined, {
          credentials: 'include',
        })
        if (response.data) {
          applyToken(response.data.accessToken)
          return true
        }
        if (response.status === 401 || response.status === 403) clear()
        return false
      } finally {
        finish()
      }
    })().finally(() => {
      refreshPromise = undefined
    })
    return refreshPromise
  }

  return {
    refresh,
    async login(credentials) {
      const finish = beginOperation('auth.login')
      try {
        const response = await http().post<LoginResponse>(endpoints.login, credentials, {
          credentials: 'include',
        })
        if (response.error) throw response.error
        if (!response.data) throw new Error('Authentication failed.')
        if (response.data.challenge) {
          const { challenge, setupSecret, accessToken } = response.data
          if (
            accessToken ||
            !/^[A-F0-9]{64}$/.test(challenge) ||
            (setupSecret != null && !/^[A-Z2-7]{32}$/.test(setupSecret))
          )
            throw new Error('Invalid authentication challenge.')
          clear()
          return { challenge, setupSecret: setupSecret ?? null }
        }
        applyToken(response.data.accessToken)
        await refreshUser()
      } catch (error) {
        clear()
        throw error
      } finally {
        finish()
      }
    },
    async logout() {
      const finish = beginOperation('auth.logout')
      try {
        const response = await http().post(endpoints.logout, undefined, { credentials: 'include' })
        if (response.error) throw response.error
      } finally {
        clear()
        finish()
      }
    },
    restore() {
      restorePromise ??= (async () => {
        // Configuration belongs to the deployment, not to the refreshed identity.
        const configuration = loadConfig()
        const session = (async () => {
          try {
            if (!(await refresh())) return false
            await refreshUser()
            return true
          } catch (error) {
            clear()
            throw error
          }
        })()
        try {
          const [configured, restored] = await Promise.allSettled([configuration, session])
          if (configured.status === 'rejected') throw configured.reason
          if (restored.status === 'rejected') throw restored.reason
          return restored.value
        } finally {
          ready.value = true
        }
      })()
      return restorePromise
    },
  }
}
