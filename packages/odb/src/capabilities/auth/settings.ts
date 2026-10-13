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
