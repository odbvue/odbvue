import type { PlsqlRenderable } from '../../schema/attribute.js'
import { cond, odbLiteral, PlsqlStatement } from '../../schema/attribute.js'
import { odbBlock, odbType } from '../../schema/package.js'
import { odbQuery } from '../../query/index.js'
import { odbSettings } from '../settings/settings.js'
import { settingsStore } from '../settings/tables.js'
import { odbGooglePackage } from './package.js'
import { googleKeys, googleTransactions } from './tables.js'
import { googleSettings } from './settings.js'

/**
 * Google OIDC primitives; the application owns Origin checks, cookies and redirects.
 * Requires settings/auth/rate-limit, outbound HTTPS trust and DBMS_CRYPTO RSA verification.
 * Commit start() before redirecting; complete() consumes the bound transaction even on failure.
 * Register /auth/google/callback once using AUTH_GOOGLE_REDIRECT_URI.
 * Login and linking share this callback; the consumed transaction determines its purpose.
 */
export const odbGoogle = {
  toSQLUp(options: { schema?: string } = {}): string {
    return [googleTransactions, googleKeys, odbGooglePackage]
      .map((artifact) => artifact.toSQLUp(options))
      .join('\n')
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [odbGooglePackage, googleKeys, googleTransactions]
      .map((artifact) => artifact.toSQLDown(options))
      .join('\n')
  },
  /** Missing-only provisioning; Google is available only after credentials are configured. */
  seedSettings() {
    return {
      toSQLUp({ schema }: { schema?: string } = {}): string {
        return googleSettings
          .map(({ id, value, meta }) =>
            odbBlock((body) => {
              const { count } = body.variables({ count: odbType.integer() })
              const query = odbQuery()
                .selectFrom(settingsStore)
                .select('COUNT(*)')
                .into(count)
                .where(cond.eq(settingsStore.id, id))
              if (schema) query.resolveSchema(schema)
              body.query(query)
              body.ifThen(cond.eq(count, 0), (then) => {
                const write = odbSettings.write(
                  odbLiteral(id),
                  odbLiteral(value),
                  odbLiteral(JSON.stringify(meta)),
                )
                then.call(schema ? new PlsqlStatement(`${schema}.${write.toSQL()}`) : write)
              })
            }),
          )
          .join('\n')
      },
      toSQLDown(): string {
        return ''
      },
    }
  },
  enabled() {
    return odbGooglePackage.enabled()
  },
  publicUrl() {
    return odbGooglePackage.publicUrl()
  },
  start(
    returnPath: PlsqlRenderable,
    authorizationUrl: PlsqlRenderable,
    browserToken: PlsqlRenderable,
  ) {
    return odbGooglePackage.start(returnPath, authorizationUrl, browserToken)
  },
  startLink(
    returnPath: PlsqlRenderable,
    userId: PlsqlRenderable,
    refreshToken: PlsqlRenderable,
    password: PlsqlRenderable,
    authorizationUrl: PlsqlRenderable,
    browserToken: PlsqlRenderable,
  ) {
    return odbGooglePackage.startLink(
      returnPath,
      userId,
      refreshToken,
      password,
      authorizationUrl,
      browserToken,
    )
  },
  complete(
    state: PlsqlRenderable,
    code: PlsqlRenderable,
    browserToken: PlsqlRenderable,
    providerError: PlsqlRenderable,
    currentRefresh: PlsqlRenderable,
    refreshToken: PlsqlRenderable,
    returnPath: PlsqlRenderable,
    outcome: PlsqlRenderable,
    purpose: PlsqlRenderable,
  ) {
    return odbGooglePackage.complete(
      state,
      code,
      browserToken,
      providerError,
      currentRefresh,
      refreshToken,
      returnPath,
      outcome,
      purpose,
    )
  },
}
