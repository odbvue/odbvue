export function authState(user: unknown = null, google = true) {
  return { user, providers: { password: true, google }, signup: true, twoFactor: true }
}
