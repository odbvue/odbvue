import type { Auth, AuthContext, AuthUser } from './types.js'

export function createSignup<User extends AuthUser>(
  context: AuthContext<User>,
): Pick<Auth<User>, 'signup' | 'confirmSignup'> {
  return {
    signup(credentials) {
      return context.anonymousPost('auth.signup', context.endpoints.signup, credentials)
    },
    confirmSignup(token) {
      return context.anonymousPost('auth.confirmSignup', context.endpoints.confirmSignup, { token })
    },
  }
}
