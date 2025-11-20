import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref } from 'vue'
import Cookies from 'js-cookie'
import { useUiStore } from './ui'
import { useHttp } from '@/composables/http'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const { startLoading, stopLoading, setError, clearMessages } = useUiStore()

    const api = useHttp()

    type AuthResponse = {
      access_token: string
      refresh_token: string
    }

    type ContextResponse = {
      version: string
      user: {
        uuid: string
        username: string
        fullname: string
        created: string
      }[]
    }

    const refreshCookieOptions = {
      path: '/',
      secure: true,
      sameSite: 'Strict' as const,
      domain: window.location.hostname,
      expires: 7,
    }

    const defaultUser = {
      uuid: '',
      username: '',
      fullname: '',
      created: '',
    }

    const accessToken = ref('')
    const isAuthenticated = ref(false)
    const user = ref({ ...defaultUser })

    function refreshToken() {
      return Cookies.get('refresh_token')
    }

    const login = async (username: string, password: string): Promise<boolean> => {
      startLoading()

      const { data, error, status } = await api.post<AuthResponse>('app/login/', {
        username,
        password,
      })

      if (error || !data) {
        const errorMessages = {
          401: 'unauthorized',
          403: 'forbidden',
          429: 'too.many.requests',
        }
        const errorMessage = errorMessages[(status as 401 | 403 | 429) ?? 401]
        isAuthenticated.value = false
        user.value = { ...defaultUser }
        setError(errorMessage)
      } else {
        accessToken.value = data.access_token
        Cookies.set('refresh_token', data.refresh_token, refreshCookieOptions)

        const { data: contextData } = await api<ContextResponse>('app/context/')
        user.value = contextData?.user[0] ?? { ...defaultUser }

        isAuthenticated.value = true
        clearMessages()
      }

      stopLoading()
      return isAuthenticated.value
    }

    const logout = () => {
      accessToken.value = ''
      Cookies.remove('refresh_token', { path: '/', domain: window.location.hostname })
      isAuthenticated.value = false
      user.value = { ...defaultUser }
      api.post('app/logout/')
      clearMessages()
    }

    const refresh = async (): Promise<boolean> => {
      const token = refreshToken()
      if (!token) {
        logout()
        return false
      }

      try {
        const { data, error, status } = await api.post<AuthResponse>('app/refresh/', null, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (error || !data) {
          const errorMessages = {
            401: 'session.expired',
            403: 'forbidden',
          }
          const errorMessage = errorMessages[(status as 401 | 403) ?? 401]
          setError(errorMessage)
          logout()
          return false
        }

        accessToken.value = data.access_token
        Cookies.set('refresh_token', data.refresh_token, refreshCookieOptions)
        isAuthenticated.value = true
        return true
      } catch {
        logout()
        return false
      }
    }

    return {
      accessToken,
      refreshToken,
      isAuthenticated,
      user,
      login,
      logout,
      refresh,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['isAuthenticated', 'user'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
