import type { ComputedRef, Ref } from 'vue'
import type { HttpClient } from '../http/core.js'

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

export interface AuthConfig {
  password: boolean
  ldap: boolean
  google: boolean
  signup: boolean
  twoFactor: boolean
}

export interface AuthChallenge {
  challenge: string
  setupSecret: string | null
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
  confirmSignup: string
  recoverPassword: string
  resetPassword: string
  changePassword: string
  avatar: string
  avatarDownload: string
  login: string
  verifyTwoFactor: string
  refresh: string
  logout: string
  config: string
  me: string
}

export type AuthHttp = Pick<HttpClient, 'get' | 'post' | 'put'>

export interface AuthOptions {
  endpoints?: Partial<AuthEndpoints>
  http: AuthHttp | (() => AuthHttp)
  /** Observes activity without making presentation state a concurrency guard. */
  onOperation?: (operation: string) => () => void
}

export interface Auth<User extends AuthUser = AuthUser> {
  user: Readonly<Ref<User | null>>
  accessToken: Readonly<Ref<string | null>>
  ready: Readonly<Ref<boolean>>
  authenticated: ComputedRef<boolean>
  config: Readonly<Ref<AuthConfig | null>>
  login(credentials: AuthCredentials): Promise<AuthChallenge | void>
  refresh(): Promise<boolean>
  logout(): Promise<void>
  restore(): Promise<boolean>
  refreshUser(): Promise<User>
  password: {
    change(credentials: ChangePasswordCredentials): Promise<void>
    recover(email: string): Promise<void>
    reset(credentials: ResetPasswordCredentials): Promise<void>
  }
  google: {
    login(options?: GoogleLoginOptions): Promise<GoogleLoginResponse>
    link(options: GoogleLinkOptions): Promise<GoogleLinkResponse>
  }
  twoFactor: {
    verify(
      challenge: string,
      code: string,
    ): Promise<{ recoveryCodes: readonly string[] } | AuthChallenge>
  }
  profile: {
    updateAvatar(avatar: string | null): Promise<void>
  }
  signup(credentials: SignupCredentials): Promise<void>
  confirmSignup(token: string): Promise<void>
  hasRole(role: string): boolean
  can(permission: string): boolean
}

export interface LoginResponse {
  accessToken: string | null
  challenge?: string | null
  setupSecret?: string | null
}

export interface AuthUserResponse {
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

export interface AuthContext<User extends AuthUser = AuthUser> {
  endpoints: AuthEndpoints
  http(): AuthHttp
  beginOperation(operation: string): () => void
  requireSession(message: string): void
  accessToken: Ref<string | null>
  clear(): void
  applyToken(token: string | null): void
  refreshUser(): Promise<User>
  anonymousPost(operation: string, endpoint: string, body: unknown): Promise<void>
  authenticatedMutation(
    method: 'post' | 'put',
    operation: string,
    endpoint: string,
    body: unknown,
    after?: () => Promise<unknown>,
  ): Promise<void>
}
