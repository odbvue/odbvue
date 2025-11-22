import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref } from 'vue'
import Cookies from 'js-cookie'
import { useAppStore } from '../index'
import { useUiStore } from './ui'
import { useHttp } from '@/composables/http'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const { startLoading, stopLoading, setError, clearMessages, setInfo } = useUiStore()

    const api = useHttp()

    type AuthResponse = {
      access_token: string
      refresh_token: string
      error?: string
      errors?: { name: string; message: string }[]
    }

    const refreshCookieOptions = {
      path: '/',
      secure: true,
      sameSite: 'Strict' as const,
      domain: window.location.hostname,
      expires: 7,
    }

    const accessToken = ref('')
    const isAuthenticated = ref(false)

    const refreshToken = () => Cookies.get('refresh_token')

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
        setError(errorMessage)
      } else {
        accessToken.value = data.access_token
        Cookies.set('refresh_token', data.refresh_token, refreshCookieOptions)
        isAuthenticated.value = true
        clearMessages()
      }

      await useAppStore().init()
      stopLoading()
      return isAuthenticated.value
    }

    const logout = async () => {
      accessToken.value = ''
      Cookies.remove('refresh_token', { path: '/', domain: window.location.hostname })
      isAuthenticated.value = false
      await api.post('app/logout/')
      await useAppStore().init()
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

    type SignupResponse = {
      access_token: string
      refresh_token: string
      error?: string
      errors?: { name: string; message: string }[]
    }

    const signup = async (
      username: string,
      password: string,
      fullname: string,
      consent: string,
    ): Promise<SignupResponse | null> => {
      startLoading()
      const { data, error } = await api.post<SignupResponse>('app/signup/', {
        username,
        password,
        fullname,
        consent,
      })
      const success = data && !data?.error && !error && !data?.errors
      if (success) {
        accessToken.value = data.access_token
        Cookies.set('refresh_token', data.refresh_token, refreshCookieOptions)
        isAuthenticated.value = true
        clearMessages()
        await useAppStore().init()
      } else {
        if (data?.error || error) setError(data?.error || 'something.went.wrong')
      }
      stopLoading()
      return data
    }

    type ConfirmEmailResponse = {
      error?: string
    }

    const confirmEmail = async (confirmToken: string): Promise<boolean> => {
      startLoading()
      const { data, error } = await api.post<ConfirmEmailResponse>('app/confirm-email/', {
        token: confirmToken,
      })
      if (data?.error || error) {
        setError(data?.error || 'something.went.wrong')
      } else {
        setInfo('email.confirmation.success')
      }
      stopLoading()
      return !data?.error
    }

    return {
      accessToken,
      refreshToken,
      isAuthenticated,
      login,
      logout,
      refresh,
      signup,
      confirmEmail,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['isAuthenticated'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
