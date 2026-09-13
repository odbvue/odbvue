import { computed, readonly, ref, shallowRef, type ComputedRef, type Ref } from 'vue'
import { defineCapability } from '../../runtime/capability.js'
import { defineContract } from '../../runtime/contract.js'
import { useOdbVue } from '../../runtime/context.js'
import type { HttpClient, HttpError } from '../http/index.js'

export interface AuthUser {
  id: string | number
  username: string
  roles?: readonly string[]
  permissions?: readonly string[]
  [key: string]: unknown
}

export interface AuthSession<User extends AuthUser = AuthUser> {
  accessToken: string
  refreshToken?: string
  user: User
}

interface AuthTokens {
  accessToken: string
  refreshToken?: string
}

interface OrdsAuthTokens {
  'access-token': string
  'refresh-token'?: string
}

interface OrdsAuthUser {
  'user-id': string | number
  username: string
  'display-name'?: string | null
}

export interface AuthCredentials {
  username: string
  password: string
}

export interface OdbVueAuthEndpoints {
  login: string
  refresh: string
  logout: string
  me: string
}

export interface OdbVueAuthOptions {
  endpoints?: Partial<OdbVueAuthEndpoints>
  enabled?: boolean
  http?: HttpClient
}

export interface OdbVueAuth<User extends AuthUser = AuthUser> {
  user: Readonly<Ref<User | null>>
  accessToken: Readonly<Ref<string | null>>
  loading: Readonly<Ref<boolean>>
  ready: Readonly<Ref<boolean>>
  authenticated: ComputedRef<boolean>
  login(credentials: AuthCredentials): Promise<void>
  logout(): Promise<void>
  refresh(): Promise<boolean>
  restore(): Promise<boolean>
  me(): Promise<User>
  hasRole(role: string): boolean
  can(permission: string): boolean
  setHttp(http: HttpClient): void
}

export const authContract = defineContract<OdbVueAuth>('auth')

/** Returns the authentication capability installed for the current application. */
export function useAuth(): OdbVueAuth {
  return useOdbVue().get(authContract)
}

const defaultEndpoints: OdbVueAuthEndpoints = {
  login: '/auth/login',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/auth/me',
}

function toError(error: HttpError | null, fallback: string): Error {
  return error ?? new Error(fallback)
}

/** Creates application-scoped authentication state backed by ORDS auth endpoints. */
export function createOdbVueAuth<User extends AuthUser = AuthUser>(
  options: OdbVueAuthOptions = {},
): OdbVueAuth<User> {
  const endpoints = { ...defaultEndpoints, ...options.endpoints }
  const user = shallowRef<User | null>(null)
  const accessToken = ref<string | null>(null)
  let refreshToken: string | null = null
  const loading = ref(false)
  const ready = ref(false)
  let http = options.http

  function requireHttp(): HttpClient {
    if (!http) throw new Error('The HTTP capability is not available.')
    return http
  }

  function clear(): void {
    user.value = null
    accessToken.value = null
    refreshToken = null
  }

  function applyTokens(tokens: AuthTokens | OrdsAuthTokens): void {
    const normalizedTokens: AuthTokens =
      'access-token' in tokens
        ? {
            accessToken: tokens['access-token'],
            refreshToken: tokens['refresh-token'],
          }
        : tokens

    accessToken.value = normalizedTokens.accessToken
    refreshToken = normalizedTokens.refreshToken ?? refreshToken
  }

  function applyUser(response: OrdsAuthUser): User {
    user.value = {
      id: response['user-id'],
      username: response.username,
      ...(response['display-name'] === undefined || response['display-name'] === null
        ? {}
        : { displayName: response['display-name'] }),
    } as User
    return user.value
  }

  async function refresh(): Promise<boolean> {
    loading.value = true
    try {
      if (!refreshToken) return false
      const response = await requireHttp().post<AuthTokens | OrdsAuthTokens>(
        endpoints.refresh,
        undefined,
        {
          headers: { 'presented-refresh-token': refreshToken },
        },
      )
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

  return {
    user: readonly(user) as Readonly<Ref<User | null>>,
    accessToken: readonly(accessToken),
    loading: readonly(loading),
    ready: readonly(ready),
    authenticated: computed(() => !!user.value && !!accessToken.value),
    async login(credentials) {
      loading.value = true
      try {
        const response = await requireHttp().post<AuthTokens | OrdsAuthTokens>(
          endpoints.login,
          undefined,
          {
            headers: { 'login-username': credentials.username, password: credentials.password },
          },
        )
        if (!response.data) throw toError(response.error, 'Authentication failed.')
        applyTokens(response.data)
        user.value = null
      } finally {
        loading.value = false
      }
    },
    async logout() {
      loading.value = true
      try {
        await requireHttp().post(endpoints.logout, undefined, {
          headers: refreshToken ? { 'presented-refresh-token': refreshToken } : undefined,
        })
      } finally {
        clear()
        loading.value = false
      }
    },
    refresh,
    async restore() {
      try {
        return await refresh()
      } finally {
        ready.value = true
      }
    },
    async me() {
      loading.value = true
      try {
        const response = await requireHttp().get<OrdsAuthUser>(endpoints.me)
        if (!response.data)
          throw toError(response.error, 'Unable to retrieve the authenticated user.')
        return applyUser(response.data)
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
    setHttp(client) {
      http = client
    },
  }
}

export const authCapability = defineCapability({
  name: 'auth',
  setup(context) {
    const config = context.config.auth
    context.provide(
      authContract,
      createOdbVueAuth({
        endpoints: typeof config === 'object' ? config.endpoints : undefined,
      }),
    )
  },
  async start(runtime) {
    if (runtime.config.auth === true || typeof runtime.config.auth === 'object')
      await runtime.get(authContract).restore()
  },
})
