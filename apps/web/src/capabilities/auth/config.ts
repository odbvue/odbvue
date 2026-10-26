import { shallowRef } from 'vue'
import type { AuthConfig, AuthHttp } from './types.js'

export function createAuthConfig(
  http: () => AuthHttp,
  endpoint: string,
  beginOperation: (operation: string) => () => void,
) {
  const config = shallowRef<AuthConfig | null>(null)
  let pending: Promise<void> | undefined

  function loadConfig(): Promise<void> {
    if (config.value) return Promise.resolve()
    pending ??= (async () => {
      const finish = beginOperation('auth.config')
      try {
        const response = await http().get<AuthConfig>(endpoint, {
          credentials: 'omit',
          skipAuthRefresh: true,
        })
        if (response.error) throw response.error
        if (
          !response.data ||
          !['password', 'ldap', 'google', 'signup', 'twoFactor'].every(
            (key) => typeof response.data?.[key as keyof AuthConfig] === 'boolean',
          )
        )
          throw new Error('Invalid authentication configuration.')
        config.value = response.data
      } finally {
        finish()
        pending = undefined
      }
    })()
    return pending
  }

  return { config, loadConfig }
}
