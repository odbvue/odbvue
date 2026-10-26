import type { Auth, AuthContext, AuthUser } from './types.js'

export function createPassword<User extends AuthUser>(
  context: AuthContext<User>,
): Auth<User>['password'] {
  return {
    async change(credentials) {
      await context.authenticatedMutation(
        'post',
        'auth.changePassword',
        context.endpoints.changePassword,
        credentials,
      )
      context.clear()
    },
    recover(email) {
      return context.anonymousPost('auth.recoverPassword', context.endpoints.recoverPassword, {
        email,
      })
    },
    async reset(credentials) {
      await context.anonymousPost(
        'auth.resetPassword',
        context.endpoints.resetPassword,
        credentials,
      )
      context.clear()
    },
  }
}
