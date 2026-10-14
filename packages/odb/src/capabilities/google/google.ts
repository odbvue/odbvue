import type { PlsqlRenderable } from '../../schema/attribute.js'
import { odbLiteral } from '../../schema/attribute.js'
import { qualify } from '../../schema/ddl.js'
import { odbSettings } from '../settings/settings.js'
import { odbGooglePackage } from './package.js'
import { googleKeys, googleTransactions } from './tables.js'
import { googleSettings } from './settings.js'

/**
 * Google OIDC primitives; the application owns Origin checks, cookies and redirects.
 * Requires settings/auth/rate-limit, outbound HTTPS trust and DBMS_CRYPTO RSA verification.
 * Commit start() before redirecting; complete() consumes the bound transaction even on failure.
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
  /** Missing-only provisioning; never replace a configured credential or enable Google. */
  seedSettings() {
    return {
      toSQLUp({ schema }: { schema?: string } = {}): string {
        return googleSettings
          .map(({ id, value, meta }) =>
            [
              'DECLARE',
              '  l_count PLS_INTEGER;',
              'BEGIN',
              `  SELECT COUNT(*) INTO l_count FROM ${qualify('odb_settings_store', schema)} WHERE id = '${id}';`,
              '  IF l_count = 0 THEN',
              `    ${schema ? `${schema}.` : ''}${odbSettings
                .write(odbLiteral(id), odbLiteral(value), odbLiteral(JSON.stringify(meta)))
                .toSQL()};`,
              '  END IF;',
              'END;',
              '/',
            ].join('\n'),
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
  complete(
    state: PlsqlRenderable,
    code: PlsqlRenderable,
    browserToken: PlsqlRenderable,
    providerError: PlsqlRenderable,
    refreshToken: PlsqlRenderable,
    returnPath: PlsqlRenderable,
    outcome: PlsqlRenderable,
  ) {
    return odbGooglePackage.complete(
      state,
      code,
      browserToken,
      providerError,
      refreshToken,
      returnPath,
      outcome,
    )
  },
}
