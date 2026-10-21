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
}

export interface AuthState<User extends AuthUser = AuthUser> {
  user: User | null
  providers: AuthProviders
  signup: boolean
}

interface AuthStateResponse {
  user: AuthUserResponse | null | string
  providers: AuthProviders | string
  signup: boolean | string
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
  refresh: string
  logout: string
  state: string
}

export interface AuthOptions {
  endpoints?: Partial<AuthEndpoints>
  http: Pick<HttpClient, 'get' | 'post'> | (() => Pick<HttpClient, 'get' | 'post'>)
}

export interface Auth<User extends AuthUser = AuthUser> {
  user: Readonly<Ref<User | null>>
  accessToken: Readonly<Ref<string | null>>
  loading: Readonly<Ref<boolean>>
  ready: Readonly<Ref<boolean>>
  authenticated: ComputedRef<boolean>
  providers: Readonly<Ref<AuthProviders | null>>
  signupEnabled: Readonly<Ref<boolean | null>>
  startGoogleLogin(options?: GoogleLoginOptions): Promise<GoogleLoginResponse>
  startGoogleLink(options: GoogleLinkOptions): Promise<GoogleLinkResponse>
  login(credentials: AuthCredentials): Promise<void>
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
  const endpoints = { ...defaultEndpoints, ...options.endpoints }
  const user = shallowRef<User | null>(null)
  const accessToken = ref<string | null>(null)
  const loading = ref(false)
  const ready = ref(false)
  const providers = shallowRef<AuthProviders | null>(null)
  const signupEnabled = ref<boolean | null>(null)
  let restorePromise: Promise<boolean> | undefined
  let avatarObjectUrl: string | null = null
  let profileRequest = 0

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
    loading.value = true
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
      loading.value = false
    }
  }

  async function anonymousPost(endpoint: string, body: unknown): Promise<void> {
    loading.value = true
    try {
      const response = await requireHttp().post(endpoint, body, { credentials: 'omit' })
      if (response.error) throw response.error
      if (response.status === null || response.status < 200 || response.status >= 300)
        throw new Error('The authentication request failed.')
    } finally {
      loading.value = false
    }
  }

  async function authenticatedPost(endpoint: string, body: unknown): Promise<void> {
    if (!ready.value || !user.value || !accessToken.value)
      throw new Error('Sign in before updating your profile.')
    if (loading.value) throw new Error('An authentication request is already in progress.')
    loading.value = true
    try {
      const response = await requireHttp().post(endpoint, body, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken.value}` },
        skipAuthRefresh: true,
      })
      if (response.error) throw response.error
      if (response.status === null || response.status < 200 || response.status >= 300)
        throw new Error('The profile request failed.')
    } finally {
      loading.value = false
    }
  }

  return {
    user: readonly(user) as Readonly<Ref<User | null>>,
    accessToken: readonly(accessToken),
    loading: readonly(loading),
    ready: readonly(ready),
    providers: readonly(providers),
    signupEnabled: readonly(signupEnabled),
    authenticated: computed(() => !!user.value && !!accessToken.value),
    async startGoogleLogin(loginOptions = {}) {
      loading.value = true
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
        loading.value = false
      }
    },
    async startGoogleLink(linkOptions) {
      if (!ready.value || !user.value || !accessToken.value)
        throw new Error('Sign in before connecting Google.')
      if (loading.value) throw new Error('An authentication request is already in progress.')
      if (!linkOptions.password) throw new Error('Current password is required.')
      loading.value = true
      try {
        const response = await requireHttp().post<GoogleLinkResponse>(
          endpoints.googleLinkStart,
          { redirect: linkOptions.redirect ?? '/account', password: linkOptions.password },
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
        loading.value = false
      }
    },
    signup(credentials) {
      return anonymousPost(endpoints.signup, credentials)
    },
    confirmEmail(token) {
      return anonymousPost(endpoints.confirmEmail, { token })
    },
    recoverPassword(email) {
      return anonymousPost(endpoints.recoverPassword, { email })
    },
    async resetPassword(credentials) {
      await anonymousPost(endpoints.resetPassword, credentials)
      clear()
    },
    async changePassword(credentials) {
      await authenticatedPost(endpoints.changePassword, credentials)
      clear()
    },
    async updateAvatar(avatar) {
      await authenticatedPost(endpoints.avatar, { avatar })
      await this.getState()
    },
    async login(credentials) {
      loading.value = true
      try {
        const response = await requireHttp().post<AuthTokens>(endpoints.login, credentials, {
          credentials: 'include',
        })
        if (!response.data) throw toError(response.error, 'Authentication failed.')
        applyTokens(response.data)
        const state = await this.getState()
        if (!state.user) throw new Error('Unable to retrieve the authenticated user.')
      } catch (error) {
        clear()
        throw error
      } finally {
        loading.value = false
      }
    },
    async logout() {
      loading.value = true
      try {
        const response = await requireHttp().post(endpoints.logout, undefined, {
          credentials: 'include',
        })
        if (response.error) throw response.error
      } finally {
        clear()
        loading.value = false
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
      loading.value = true
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
        if (
          typeof capabilities?.password !== 'boolean' ||
          typeof capabilities?.google !== 'boolean' ||
          typeof signup !== 'boolean' ||
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
        return { user: currentUser, providers: capabilities, signup }
      } finally {
        loading.value = false
      }
    },
    hasRole(role) {
      return user.value?.roles?.includes(role) ?? false
    },
    can(permission) {
      return user.value?.permissions?.includes(permission) ?? false
    },
  }
}
