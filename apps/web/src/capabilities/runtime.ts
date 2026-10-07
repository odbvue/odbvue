import { createAuth } from './auth/core.js'
import { appConfig } from './config'
import { captureError } from './errors'
import { createHttp } from './http/core.js'

// Auth requests resolve the shared client only after both instances have been constructed.
export const auth = createAuth({
  endpoints: appConfig.auth?.endpoints,
  http: () => http,
})

export const http = createHttp({
  ...appConfig.http,
  getAccessToken: () => auth.accessToken.value,
  refreshAccessToken: () => auth.refresh(),
  onError: (error) => captureError(error, { source: 'http', context: { request: error.request } }),
})
