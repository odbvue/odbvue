import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { createAuthRuntime, readonlyAuth } from './auth/core.js'
import { appConfig } from './config'
import { captureError } from './errors'
import { createHttp } from './http/core.js'
import { pinia } from './state'
import { useUi } from './ui/store'

// Auth requests resolve the shared client only after both instances have been constructed.
const useAuthStore = defineStore('auth', () =>
  createAuthRuntime({
    endpoints: appConfig.auth?.endpoints,
    http: () => http,
    onOperation: (operation) => useUi().loading.start(operation),
  }),
)

const authStore = useAuthStore(pinia)
const { user, accessToken, ready, authenticated, config } = storeToRefs(authStore)
export const auth = readonlyAuth({ ...authStore, user, accessToken, ready, authenticated, config })

export const http = createHttp({
  ...appConfig.http,
  getAccessToken: () => auth.accessToken.value,
  refreshAccessToken: () => auth.refresh(),
  onError: (error) => captureError(error, { source: 'http', context: { request: error.request } }),
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
