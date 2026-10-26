import type { Auth, AuthContext, AuthUser, GoogleLoginResponse } from './types.js'

function validateAuthorization(response: GoogleLoginResponse | null): GoogleLoginResponse {
  if (typeof response?.authorizationUrl !== 'string')
    throw new Error('Unable to start Google authorization.')
  const url = new URL(response.authorizationUrl)
  if (
    url.origin !== 'https://accounts.google.com' ||
    url.pathname !== '/o/oauth2/v2/auth' ||
    url.username ||
    url.password
  )
    throw new Error('Invalid Google authorization URL.')
  return response
}

export function createGoogle<User extends AuthUser>(
  context: AuthContext<User>,
): Auth<User>['google'] {
  let linking = false
  return {
    async login(options = {}) {
      const finish = context.beginOperation('auth.googleLogin')
      try {
        const response = await context
          .http()
          .post<GoogleLoginResponse>(context.endpoints.googleStart, options, {
            credentials: 'include',
          })
        if (response.error) throw response.error
        return validateAuthorization(response.data)
      } finally {
        finish()
      }
    },
    async link(options) {
      context.requireSession('Sign in before connecting Google.')
      if (!options.password) throw new Error('Current password is required.')
      if (linking) throw new Error('A Google linking request is already in progress.')
      const finish = context.beginOperation('auth.googleLink')
      linking = true
      try {
        const response = await context.http().post<GoogleLoginResponse>(
          context.endpoints.googleLinkStart,
          { redirect: options.redirect ?? '/settings/account', password: options.password },
          {
            credentials: 'include',
            headers: { Authorization: ['Bearer', context.accessToken.value].join(' ') },
            skipAuthRefresh: true,
          },
        )
        if (response.error) throw response.error
        if (response.status === null || response.status < 200 || response.status >= 300)
          throw new Error('Unable to connect Google.')
        return validateAuthorization(response.data)
      } finally {
        linking = false
        finish()
      }
    },
  }
}
