import { computed, readonly, ref, shallowRef, type ComputedRef, type Ref } from 'vue'
import type { HttpClient, HttpError } from '../http/core.js'

export interface AuthUser {
  id: string | number
  username: string
  displayName?: string
  avatarUrl?: string | null
  avatarUploaded?: boolean
  passwordConnected?: boolean
  googleConnected?: boolean
  roles?: readonly string[]
  permissions?: readonly string[]
  [key: string]: unknown
}

export interface AuthSession<User extends AuthUser = AuthUser> {
  accessToken: string
  user: User
}

interface AuthTokens {
  accessToken: string
}

export interface AuthChallenge {
  challenge: string
  setupSecret: string | null
}

interface LoginResponse {
  accessToken: string | null
  challenge?: string | null
  setupSecret?: string | null
}

interface TwoFactorResponse extends LoginResponse {
  recoveryCodes: readonly string[] | string
}

interface AuthUserResponse {
  userId: string | number
  username: string
  displayName?: string | null
  avatarUrl?: string | null
  avatarUploaded?: number
  avatarId?: string | null
  passwordConnected?: number
  googleConnected?: number
  roles?: readonly string[] | string
  permissions?: readonly string[] | string
}

export interface AuthCredentials {
  username: string
  password: string
}

export interface SignupCredentials {
  email: string
  fullName: string
  password: string
  passwordRepeat: string
}

export interface ResetPasswordCredentials {
  token: string
  password: string
  passwordRepeat: string
}

export interface ChangePasswordCredentials {
  currentPassword: string
  password: string
  passwordRepeat: string
}

export interface AuthProviders {
  password: boolean
  google: boolean
  ldap?: boolean
}

export interface AuthState<User extends AuthUser = AuthUser> {
  user: User | null
  providers: AuthProviders
  signup: boolean
  twoFactor: boolean
}

interface AuthStateResponse {
  user: AuthUserResponse | null | string
  providers: AuthProviders | string
  signup: boolean | string
  twoFactor: boolean | string
}

export interface GoogleLoginOptions {
  redirect?: string
}

export interface GoogleLoginResponse {
  authorizationUrl: string
}

export interface GoogleLinkOptions {
  redirect?: string
  password: string
}

export type GoogleLinkResponse = GoogleLoginResponse

export interface AuthEndpoints {
  googleStart: string
  googleLinkStart: string
  signup: string
  confirmEmail: string
  recoverPassword: string
  resetPassword: string
  changePassword: string
  avatar: string
  login: string
  verifyTwoFactor: string
  refresh: string
  logout: string
  state: string
}

export interface AuthOptions {
  endpoints?: Partial<AuthEndpoints>
  http: Pick<HttpClient, 'get' | 'post'> | (() => Pick<HttpClient, 'get' | 'post'>)
  /** Observes activity without making presentation state a concurrency guard. */
  onOperation?: (operation: string) => () => void
}

export interface Auth<User extends AuthUser = AuthUser> {
  user: Readonly<Ref<User | null>>
  accessToken: Readonly<Ref<string | null>>
  ready: Readonly<Ref<boolean>>
  authenticated: ComputedRef<boolean>
  providers: Readonly<Ref<AuthProviders | null>>
  signupEnabled: Readonly<Ref<boolean | null>>
  twoFactorEnabled: Readonly<Ref<boolean | null>>
  startGoogleLogin(options?: GoogleLoginOptions): Promise<GoogleLoginResponse>
  startGoogleLink(options: GoogleLinkOptions): Promise<GoogleLinkResponse>
  login(credentials: AuthCredentials): Promise<AuthChallenge | void>
  verifyTwoFactor(
    challenge: string,
    code: string,
  ): Promise<{ recoveryCodes: readonly string[] } | AuthChallenge>
  signup(credentials: SignupCredentials): Promise<void>
  confirmEmail(token: string): Promise<void>
  recoverPassword(email: string): Promise<void>
  resetPassword(credentials: ResetPasswordCredentials): Promise<void>
  changePassword(credentials: ChangePasswordCredentials): Promise<void>
  updateAvatar(avatar: string | null): Promise<void>
  logout(): Promise<void>
  refresh(): Promise<boolean>
  restore(): Promise<boolean>
  getState(): Promise<AuthState<User>>
  hasRole(role: string): boolean
  can(permission: string): boolean
}

const defaultEndpoints: AuthEndpoints = {
  googleStart: '/auth/google/start',
  googleLinkStart: '/auth/google/link/start',
  signup: '/auth/signup',
  confirmEmail: '/auth/confirm-email',
  recoverPassword: '/auth/recover-password',
  resetPassword: '/auth/reset-password',
  changePassword: '/auth/change-password',
  avatar: '/auth/avatar',
  login: '/auth/login',
  verifyTwoFactor: '/auth/two-factor/verify',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  state: '/auth/state',
}

function toError(error: HttpError | null, fallback: string): Error {
  return error ?? new Error(fallback)
}

function validateGoogleAuthorization(response: GoogleLoginResponse | null): GoogleLoginResponse {
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

function authorizationNames(value: readonly string[] | string | undefined): readonly string[] {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) && parsed.every((name) => typeof name === 'string') ? parsed : []
  } catch {
    return []
  }
}

/** Creates application-scoped authentication state backed by ORDS auth endpoints. */
export function createAuth<User extends AuthUser = AuthUser>(options: AuthOptions): Auth<User> {
  return readonlyAuth(createAuthRuntime<User>(options))
}

/** Builds the mutable state and actions owned by the application's Pinia auth store. */
export function createAuthRuntime<User extends AuthUser = AuthUser>(options: AuthOptions) {
  const endpoints = { ...defaultEndpoints, ...options.endpoints }
  const user: Ref<User | null> = shallowRef(null)
  const accessToken = ref<string | null>(null)
  const ready = ref(false)
  const providers = shallowRef<AuthProviders | null>(null)
  const signupEnabled = ref<boolean | null>(null)
  const twoFactorEnabled = ref<boolean | null>(null)
  let restorePromise: Promise<boolean> | undefined
  let avatarObjectUrl: string | null = null
  let profileRequest = 0
  let activeRequests = 0

  function beginOperation(operation: string): () => void {
    const finish = options.onOperation?.(operation)
    activeRequests++
    return () => {
      activeRequests--
      finish?.()
    }
  }

  function requireHttp(): Pick<HttpClient, 'get' | 'post'> {
    return 'get' in options.http ? options.http : options.http()
  }

  function clear(): void {
    profileRequest++
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl)
    avatarObjectUrl = null
    user.value = null
    accessToken.value = null
  }

  function applyTokens(tokens: AuthTokens): void {
    if (typeof tokens.accessToken !== 'string' || !tokens.accessToken)
      throw new Error('Invalid authentication token response.')
    accessToken.value = tokens.accessToken
  }

  async function applyUser(response: AuthUserResponse, request: number): Promise<User> {
    let avatar: Blob | null = null
    if (response.avatarUploaded === 1) {
      if (!response.avatarId || !/^[a-f0-9]{32}$/i.test(response.avatarId))
        throw new Error('Invalid avatar storage key.')
      const download = await requireHttp().get<Blob>(`${endpoints.avatar}/${response.avatarId}`, {
        responseType: 'blob',
        headers: { Authorization: ['Bearer', accessToken.value].join(' ') },
      })
      if (download.error) throw download.error
      if (!(download.data instanceof Blob) || download.data.type !== 'image/jpeg')
        throw new Error('Unable to retrieve the profile avatar.')
      avatar = download.data
    }
    if (request !== profileRequest) throw new Error('The profile request is no longer current.')
    const previousUrl = avatarObjectUrl
    avatarObjectUrl = avatar ? URL.createObjectURL(avatar) : null
    user.value = {
      id: response.userId,
      username: response.username,
      roles: authorizationNames(response.roles),
      permissions: authorizationNames(response.permissions),
      avatarUrl: avatarObjectUrl ?? response.avatarUrl ?? null,
      avatarUploaded: response.avatarUploaded === 1,
      passwordConnected:
        response.passwordConnected === undefined ? undefined : response.passwordConnected > 0,
      googleConnected:
        response.googleConnected === undefined ? undefined : response.googleConnected > 0,
      ...(response.displayName === undefined || response.displayName === null
        ? {}
        : { displayName: response.displayName }),
    } as User
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    return user.value
  }

  async function refresh(): Promise<boolean> {
    const finish = beginOperation('auth.refresh')
    try {
      const response = await requireHttp().post<AuthTokens>(endpoints.refresh, undefined, {
        credentials: 'include',
      })
      if (response.data) {
        applyTokens(response.data)
        return true
      }
      // A missing response means the refresh cookie is invalid, not an offline browser.
      if (response.status === 401 || response.status === 403) clear()
      return false
    } finally {
      finish()
    }
  }

  async function anonymousPost(operation: string, endpoint: string, body: unknown): Promise<void> {
    const finish = beginOperation(operation)
    try {
      const response = await requireHttp().post(endpoint, body, { credentials: 'omit' })
      if (response.error) throw response.error
      if (response.status === null || response.status < 200 || response.status >= 300)
        throw new Error('The authentication request failed.')
    } finally {
      finish()
    }
  }

  async function authenticatedPost(
    operation: string,
    endpoint: string,
    body: unknown,
    after?: () => Promise<unknown>,
  ): Promise<void> {
    if (!ready.value || !user.value || !accessToken.value)
      throw new Error('Sign in before updating your profile.')
    if (activeRequests > 0) throw new Error('An authentication request is already in progress.')
    const finish = beginOperation(operation)
    try {
      const response = await requireHttp().post(endpoint, body, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken.value}` },
        skipAuthRefresh: true,
      })
      if (response.error) throw response.error
      if (response.status === null || response.status < 200 || response.status >= 300)
        throw new Error('The profile request failed.')
      await after?.()
    } finally {
      finish()
    }
  }

  const auth: Auth<User> = {
    user,
    accessToken,
    ready,
    providers,
    signupEnabled,
    twoFactorEnabled,
    authenticated: computed(() => !!user.value && !!accessToken.value),
    async startGoogleLogin(loginOptions = {}) {
      const finish = beginOperation('auth.googleLogin')
      try {
        const response = await requireHttp().post<GoogleLoginResponse>(
          endpoints.googleStart,
          loginOptions,
          { credentials: 'include' },
        )
        if (response.error) throw response.error
        if (typeof response.data?.authorizationUrl !== 'string')
          throw new Error('Unable to start Google sign-in.')
        return validateGoogleAuthorization(response.data)
      } finally {
        finish()
      }
    },
    async startGoogleLink(linkOptions) {
      if (!ready.value || !user.value || !accessToken.value)
        throw new Error('Sign in before connecting Google.')
      if (activeRequests > 0) throw new Error('An authentication request is already in progress.')
      if (!linkOptions.password) throw new Error('Current password is required.')
      const finish = beginOperation('auth.googleLink')
      try {
        const response = await requireHttp().post<GoogleLinkResponse>(
          endpoints.googleLinkStart,
          { redirect: linkOptions.redirect ?? '/settings/account', password: linkOptions.password },
          {
            credentials: 'include',
            headers: { Authorization: ['Bearer', accessToken.value].join(' ') },
            skipAuthRefresh: true,
          },
        )
        if (response.error) throw response.error
        if (response.status === null || response.status < 200 || response.status >= 300)
          throw new Error('Unable to connect Google.')
        return validateGoogleAuthorization(response.data)
      } finally {
        finish()
      }
    },
    signup(credentials) {
      return anonymousPost('auth.signup', endpoints.signup, credentials)
    },
    confirmEmail(token) {
      return anonymousPost('auth.confirmEmail', endpoints.confirmEmail, { token })
    },
    recoverPassword(email) {
      return anonymousPost('auth.recoverPassword', endpoints.recoverPassword, { email })
    },
    async resetPassword(credentials) {
      await anonymousPost('auth.resetPassword', endpoints.resetPassword, credentials)
      clear()
    },
    async changePassword(credentials) {
      await authenticatedPost('auth.changePassword', endpoints.changePassword, credentials)
      clear()
    },
    async updateAvatar(avatar) {
      await authenticatedPost('auth.avatar', endpoints.avatar, { avatar }, () => auth.getState())
    },
    async login(credentials) {
      const finish = beginOperation('auth.login')
      try {
        const response = await requireHttp().post<LoginResponse>(endpoints.login, credentials, {
          credentials: 'include',
        })
        if (response.error) throw response.error
        if (!response.data) throw toError(response.error, 'Authentication failed.')
        if (response.data.challenge) {
          const { challenge, setupSecret, accessToken: token } = response.data
          if (
            token ||
            !/^[A-F0-9]{64}$/.test(challenge) ||
            (setupSecret != null && !/^[A-Z2-7]{32}$/.test(setupSecret))
          )
            throw new Error('Invalid authentication challenge.')
          clear()
          return { challenge, setupSecret: setupSecret ?? null }
        }
        if (!response.data.accessToken) throw new Error('Missing authentication token.')
        applyTokens({ accessToken: response.data.accessToken })
        const state = await this.getState()
        if (!state.user) throw new Error('Unable to retrieve the authenticated user.')
      } catch (error) {
        clear()
        throw error
      } finally {
        finish()
      }
    },
    async verifyTwoFactor(challenge, code) {
      const finish = beginOperation('auth.verifyTwoFactor')
      try {
        const response = await requireHttp().post<TwoFactorResponse>(
          endpoints.verifyTwoFactor,
          { challenge, code },
          { credentials: 'include', skipAuthRefresh: true },
        )
        if (response.error) throw response.error
        if (!response.data) throw new Error('Two-factor verification failed.')
        if (response.data.challenge) {
          const { challenge: nextChallenge, setupSecret, accessToken: token } = response.data
          if (
            token ||
            !/^[A-F0-9]{64}$/.test(nextChallenge) ||
            typeof setupSecret !== 'string' ||
            !/^[A-Z2-7]{32}$/.test(setupSecret)
          )
            throw new Error('Invalid authenticator recovery challenge.')
          clear()
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
        if (!response.data.accessToken) throw new Error('Missing authentication token.')
        applyTokens({ accessToken: response.data.accessToken })
        const state = await this.getState()
        if (!state.user) throw new Error('Unable to retrieve the authenticated user.')
        return { recoveryCodes: codes }
      } catch (error) {
        clear()
        throw error
      } finally {
        finish()
      }
    },
    async logout() {
      const finish = beginOperation('auth.logout')
      try {
        const response = await requireHttp().post(endpoints.logout, undefined, {
          credentials: 'include',
        })
        if (response.error) throw response.error
      } finally {
        clear()
        finish()
      }
    },
    refresh,
    restore() {
      restorePromise ??= (async () => {
        try {
          const refreshed = await refresh()
          const state = await this.getState()
          if (refreshed && !state.user)
            throw new Error('Unable to retrieve the authenticated user.')
          return refreshed && state.user !== null
        } catch (error) {
          clear()
          throw error
        } finally {
          ready.value = true
        }
      })()
      return restorePromise
    },
    async getState() {
      const request = ++profileRequest
      const finish = beginOperation('auth.profile')
      try {
        const response = await requireHttp().get<AuthStateResponse>(endpoints.state, {
          headers: accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {},
        })
        if (response.error) throw response.error
        if (!response.data) throw new Error('Unable to retrieve authentication state.')
        const profile: AuthUserResponse | null =
          typeof response.data.user === 'string'
            ? JSON.parse(response.data.user)
            : response.data.user
        const capabilities: AuthProviders =
          typeof response.data.providers === 'string'
            ? JSON.parse(response.data.providers)
            : response.data.providers
        const signup =
          typeof response.data.signup === 'string'
            ? JSON.parse(response.data.signup)
            : response.data.signup
        const twoFactor =
          typeof response.data.twoFactor === 'string'
            ? JSON.parse(response.data.twoFactor)
            : response.data.twoFactor
        if (
          typeof capabilities?.password !== 'boolean' ||
          typeof capabilities?.google !== 'boolean' ||
          (capabilities.ldap !== undefined && typeof capabilities.ldap !== 'boolean') ||
          typeof signup !== 'boolean' ||
          typeof twoFactor !== 'boolean' ||
          (profile !== null &&
            (!profile ||
              !['string', 'number'].includes(typeof profile.userId) ||
              typeof profile.username !== 'string'))
        )
          throw new Error('Invalid authentication state.')
        if (request !== profileRequest) throw new Error('The profile request is no longer current.')
        let currentUser: User | null = null
        if (profile === null) clear()
        else currentUser = await applyUser(profile, request)
        providers.value = capabilities
        signupEnabled.value = signup
        twoFactorEnabled.value = twoFactor
        return { user: currentUser, providers: capabilities, signup, twoFactor }
      } finally {
        finish()
      }
    },
    hasRole(role) {
      return user.value?.roles?.includes(role) ?? false
    },
    can(permission) {
      return user.value?.permissions?.includes(permission) ?? false
    },
  }
  return { ...auth, user, accessToken, ready, providers, signupEnabled, twoFactorEnabled }
}

/** Keeps application-facing state read-only without hiding state from Pinia. */
export function readonlyAuth<User extends AuthUser>(auth: Auth<User>): Auth<User> {
  return {
    ...auth,
    user: readonly(auth.user) as Readonly<Ref<User | null>>,
    accessToken: readonly(auth.accessToken),
    ready: readonly(auth.ready),
    providers: readonly(auth.providers),
    signupEnabled: readonly(auth.signupEnabled),
    twoFactorEnabled: readonly(auth.twoFactorEnabled),
  }
}
