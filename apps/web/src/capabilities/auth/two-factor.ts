import type { Auth, AuthContext, AuthUser, LoginResponse } from './types.js'

interface TwoFactorResponse extends LoginResponse {
  recoveryCodes: readonly string[] | string
}

export function createTwoFactor<User extends AuthUser>(
  context: AuthContext<User>,
): Auth<User>['twoFactor'] {
  return {
    async verify(challenge, code) {
      const finish = context.beginOperation('auth.verifyTwoFactor')
      try {
        const response = await context
          .http()
          .post<TwoFactorResponse>(
            context.endpoints.verifyTwoFactor,
            { challenge, code },
            { credentials: 'include', skipAuthRefresh: true },
          )
        if (response.error) throw response.error
        if (!response.data) throw new Error('Two-factor verification failed.')
        if (response.data.challenge) {
          const { challenge: nextChallenge, setupSecret, accessToken } = response.data
          if (
            accessToken ||
            !/^[A-F0-9]{64}$/.test(nextChallenge) ||
            typeof setupSecret !== 'string' ||
            !/^[A-Z2-7]{32}$/.test(setupSecret)
          )
            throw new Error('Invalid authenticator recovery challenge.')
          context.clear()
          return { challenge: nextChallenge, setupSecret }
        }
        const codes: unknown =
          typeof response.data.recoveryCodes === 'string'
            ? JSON.parse(response.data.recoveryCodes)
            : response.data.recoveryCodes
        if (
          !Array.isArray(codes) ||
          ![0, 10].includes(codes.length) ||
          !codes.every((value) => typeof value === 'string' && /^[A-F0-9]{32}$/.test(value)) ||
          new Set(codes).size !== codes.length
        )
          throw new Error('Invalid recovery code response.')
        context.applyToken(response.data.accessToken)
        await context.refreshUser()
        return { recoveryCodes: codes }
      } catch (error) {
        context.clear()
        throw error
      } finally {
        finish()
      }
    },
  }
}
