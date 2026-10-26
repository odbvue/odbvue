export function authConfig(google = true) {
  return { password: true, ldap: false, google, signup: true, twoFactor: true }
}
