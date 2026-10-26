import { computed, readonly, ref, type Ref } from 'vue'
import { createAuthConfig } from './config.js'
import { createGoogle } from './google.js'
import { createPassword } from './password.js'
import { createProfile } from './profile.js'
import { createSession } from './session.js'
import { createSignup } from './signup.js'
import { createTwoFactor } from './two-factor.js'
import { createUser } from './user.js'
import type { Auth, AuthContext, AuthEndpoints, AuthOptions, AuthUser } from './types.js'

export type * from './types.js'

const defaultEndpoints: AuthEndpoints = {
  googleStart: '/auth/google/start',
  googleLinkStart: '/auth/google/link/start',
  signup: '/auth/signup',
  confirmSignup: '/auth/signup/confirm',
  recoverPassword: '/auth/password/recover',
  resetPassword: '/auth/password/reset',
  changePassword: '/auth/password/change',
  avatar: '/auth/me/avatar',
  avatarDownload: '/auth/avatar',
  login: '/auth/login',
  verifyTwoFactor: '/auth/two-factor/verify',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  config: '/auth/config',
  me: '/auth/me',
}

/** Creates application-scoped authentication without loading application services. */
export function createAuth<User extends AuthUser = AuthUser>(options: AuthOptions): Auth<User> {
  return readonlyAuth(createAuthRuntime<User>(options))
}

/** Builds the mutable state and actions owned by the application's Pinia auth store. */
export function createAuthRuntime<User extends AuthUser = AuthUser>(options: AuthOptions) {
  const endpoints = { ...defaultEndpoints, ...options.endpoints }
  const accessToken = ref<string | null>(null)
  const ready = ref(false)
  let activeRequests = 0

  function beginOperation(operation: string): () => void {
    const finish = options.onOperation?.(operation)
    activeRequests++
    return () => {
      activeRequests--
      finish?.()
    }
  }

  const http = () => ('get' in options.http ? options.http : options.http())
  const { user, clearUser, refreshUser } = createUser<User>(
    http,
    endpoints,
    accessToken,
    beginOperation,
  )
  const { config, loadConfig } = createAuthConfig(http, endpoints.config, beginOperation)

  function clear(): void {
    clearUser()
    accessToken.value = null
  }

  function applyToken(token: string | null): void {
    if (typeof token !== 'string' || !token) throw new Error('Missing authentication token.')
    accessToken.value = token
  }

  function requireSession(message: string): void {
    if (!ready.value || !user.value || !accessToken.value) throw new Error(message)
    if (activeRequests > 0) throw new Error('An authentication request is already in progress.')
  }

  const context: AuthContext<User> = {
    endpoints,
    http,
    accessToken,
    beginOperation,
    requireSession,
    clear,
    applyToken,
    refreshUser,
    async anonymousPost(operation, endpoint, body) {
      const finish = beginOperation(operation)
      try {
        const response = await http().post(endpoint, body, { credentials: 'omit' })
        if (response.error) throw response.error
        if (response.status === null || response.status < 200 || response.status >= 300)
          throw new Error('The authentication request failed.')
      } finally {
        finish()
      }
    },
    async authenticatedMutation(method, operation, endpoint, body, after) {
      requireSession('Sign in before updating your profile.')
      const finish = beginOperation(operation)
      try {
        const response = await http()[method](endpoint, body, {
          credentials: 'include',
          headers: { Authorization: ['Bearer', accessToken.value].join(' ') },
          skipAuthRefresh: true,
        })
        if (response.error) throw response.error
        if (response.status === null || response.status < 200 || response.status >= 300)
          throw new Error('The profile request failed.')
        await after?.()
      } finally {
        finish()
      }
    },
  }

  const auth: Auth<User> = {
    user,
    accessToken,
    ready,
    config,
    authenticated: computed(() => !!user.value && !!accessToken.value),
    password: createPassword(context),
    google: createGoogle(context),
    twoFactor: createTwoFactor(context),
    profile: createProfile(context),
    ...createSignup(context),
    ...createSession(context, ready, loadConfig),
    refreshUser,
    hasRole(role) {
      return user.value?.roles?.includes(role) ?? false
    },
    can(permission) {
      return user.value?.permissions?.includes(permission) ?? false
    },
  }
  return { ...auth, user, accessToken, ready, config }
}

/** Keeps application-facing state read-only without hiding state from Pinia. */
export function readonlyAuth<User extends AuthUser>(auth: Auth<User>): Auth<User> {
  return {
    ...auth,
    user: readonly(auth.user) as Readonly<Ref<User | null>>,
    accessToken: readonly(auth.accessToken),
    ready: readonly(auth.ready),
    config: readonly(auth.config),
  }
}
