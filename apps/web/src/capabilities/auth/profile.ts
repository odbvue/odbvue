import type { Auth, AuthContext, AuthUser } from './types.js'

export function createProfile<User extends AuthUser>(
  context: AuthContext<User>,
): Auth<User>['profile'] {
  return {
    updateAvatar(avatar) {
      return context.authenticatedMutation(
        'put',
        'auth.avatar',
        context.endpoints.avatar,
        { avatar },
        context.refreshUser,
      )
    },
  }
}
