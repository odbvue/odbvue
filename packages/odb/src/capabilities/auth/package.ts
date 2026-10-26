import { odbPackage } from '../../schema/package.js'
import { defineAuthPolicy } from './core/policy.js'
import { defineAuthIdentities } from './core/identities.js'
import { defineAuthSessions } from './core/sessions.js'
import { defineAuthUsers } from './core/users.js'
import { defineAuthAuthorization } from './core/authorization.js'
import { defineAuthSignup } from './features/signup/definition.js'
import { defineAuthPassword } from './features/password/definition.js'
import { defineLdapCredentials } from './features/ldap/credentials.js'
import { defineAuthLogin } from './login.js'
import { defineAuthTwoFactor } from './features/two-factor/definition.js'
import { defineAuthGoogle } from './features/google/definition.js'
import { defineAuthProfile } from './features/profile/definition.js'

/** One transport-independent PL/SQL API, composed from typed auth domains. */
export const odbAuthPackage = odbPackage('odb_auth', (pkg) => {
  const policy = defineAuthPolicy(pkg)
  const identities = defineAuthIdentities(pkg)
  const sessions = defineAuthSessions(pkg)
  const dependencies = { ...policy, ...identities, ...sessions }
  const signup = defineAuthSignup(pkg, dependencies)
  const password = defineAuthPassword(pkg, dependencies)
  const verifyLdapCredentials = defineLdapCredentials(pkg)
  const login = defineAuthLogin(pkg, { ...dependencies, verifyLdapCredentials })
  const twoFactor = defineAuthTwoFactor(pkg, { ...dependencies, ...login })
  const google = defineAuthGoogle(pkg, dependencies)
  const users = defineAuthUsers(pkg)
  const profile = defineAuthProfile(pkg)
  const authorization = defineAuthAuthorization(pkg)
  return {
    enabled: policy.featureEnabled,
    ...signup,
    ...password,
    login: login.login,
    ...twoFactor,
    ...google,
    refresh: sessions.refresh,
    logout: sessions.logout,
    ...users,
    ...profile,
    ...authorization,
  }
})
