import { shallowRef, type Ref } from 'vue'
import type { AuthEndpoints, AuthHttp, AuthUser, AuthUserResponse } from './types.js'

function authorizationNames(value: readonly string[] | string | undefined): readonly string[] {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) && parsed.every((name) => typeof name === 'string') ? parsed : []
  } catch {
    return []
  }
}

export function createUser<User extends AuthUser>(
  http: () => AuthHttp,
  endpoints: AuthEndpoints,
  accessToken: Ref<string | null>,
  beginOperation: (operation: string) => () => void,
) {
  const user: Ref<User | null> = shallowRef(null)
  let objectUrl: string | null = null
  let profileRequest = 0

  function clearUser() {
    profileRequest++
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = null
    user.value = null
  }

  async function refreshUser(): Promise<User> {
    const request = ++profileRequest
    const finish = beginOperation('auth.profile')
    try {
      if (!accessToken.value) throw new Error('Sign in before loading your profile.')
      const response = await http().get<AuthUserResponse>(endpoints.me, {
        headers: { Authorization: ['Bearer', accessToken.value].join(' ') },
      })
      if (response.error) throw response.error
      const profile = response.data
      if (
        !profile ||
        !['string', 'number'].includes(typeof profile.userId) ||
        typeof profile.username !== 'string'
      )
        throw new Error('Invalid authenticated user response.')
      let avatar: Blob | null = null
      if (profile.avatarUploaded === 1) {
        if (!profile.avatarId || !/^[a-f0-9]{32}$/i.test(profile.avatarId))
          throw new Error('Invalid avatar storage key.')
        const download = await http().get<Blob>(`${endpoints.avatarDownload}/${profile.avatarId}`, {
          responseType: 'blob',
          headers: { Authorization: ['Bearer', accessToken.value].join(' ') },
        })
        if (download.error) throw download.error
        if (!(download.data instanceof Blob) || download.data.type !== 'image/jpeg')
          throw new Error('Unable to retrieve the profile avatar.')
        avatar = download.data
      }
      if (request !== profileRequest) throw new Error('The profile request is no longer current.')
      const previousUrl = objectUrl
      objectUrl = avatar ? URL.createObjectURL(avatar) : null
      user.value = {
        id: profile.userId,
        username: profile.username,
        roles: authorizationNames(profile.roles),
        permissions: authorizationNames(profile.permissions),
        avatarUrl: objectUrl ?? profile.avatarUrl ?? null,
        avatarUploaded: profile.avatarUploaded === 1,
        passwordConnected:
          profile.passwordConnected === undefined ? undefined : profile.passwordConnected > 0,
        googleConnected:
          profile.googleConnected === undefined ? undefined : profile.googleConnected > 0,
        ...(profile.displayName == null ? {} : { displayName: profile.displayName }),
      } as User
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      return user.value
    } finally {
      finish()
    }
  }

  return { user, clearUser, refreshUser }
}
