export const authPolicySettings = [
  ['password', 'AUTH_PASSWORD_ENABLED'],
  ['twoFactor', 'AUTH_TWO_FACTOR_ENABLED'],
  ['google', 'AUTH_GOOGLE_ENABLED'],
  ['signup', 'AUTH_SIGNUP_ENABLED'],
] as const

export type AuthFeature = (typeof authPolicySettings)[number][0]
export type AuthConfig = Partial<Record<AuthFeature, boolean>>

export const authJwtSettings = {
  defaultIssuer: 'odbvue',
  defaultExpirationSeconds: 900,
  maxExpirationSeconds: 86400,
  cacheSeconds: 30,
  secretPattern: '^[0-9A-Fa-f]{64}$',
  issuerPattern: '^[!-~]{1,255}$',
  expirationPattern: '^[0-9]{1,5}$',
  secretValid(value: unknown): value is string {
    return typeof value === 'string' && value.match(new RegExp(this.secretPattern))?.[0] === value
  },
  issuerValid(value: unknown): value is string {
    return typeof value === 'string' && value.match(new RegExp(this.issuerPattern))?.[0] === value
  },
  expirationValid(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= this.maxExpirationSeconds
    )
  },
}
