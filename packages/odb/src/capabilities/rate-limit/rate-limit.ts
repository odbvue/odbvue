import { odbRateLimitApi } from './package.js'
import { rateLimitBuckets } from './tables.js'

export { odbRateLimitApi } from './package.js'
export { rateLimitBuckets } from './tables.js'

/** Shared fixed-window failure throttle for sensitive PL/SQL procedures. */
export const odbRateLimit = {
  toSQLUp(options: { schema?: string } = {}): string {
    return [rateLimitBuckets.toSQLUp(options), odbRateLimitApi.toSQLUp(options)].join('\n')
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [odbRateLimitApi.toSQLDown(options), rateLimitBuckets.toSQLDown(options)].join('\n')
  },
  upgrade() {
    return {
      toSQLUp(options: { schema?: string } = {}): string {
        return odbRateLimitApi.toSQLUp(options)
      },
      toSQLDown() {
        return ''
      },
    }
  },
}
