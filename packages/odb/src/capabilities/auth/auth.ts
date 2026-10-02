// Auth capability: users/sessions tables and the `odb_auth` PL/SQL package, defined in TypeScript.
// The package owns password, token and session logic and raises transport-independent ODB errors;
// headers, cookies, HTTP status mapping, ORDS routes and authorization policy belong to the application.

import {
  cond,
  odbLiteral,
  PlsqlExpression,
  plsqlExpr,
  renderPlsql,
  type PlsqlRenderable,
} from '../../schema/attribute.js'
import { plsqlBlock, qualify } from '../../schema/ddl.js'
import { odbQuery } from '../../query/index.js'
import { odbOracle } from '../../oracle/index.js'
import { odbRateLimit } from '../rate-limit/rate-limit.js'
import { REFRESH_TOKEN_MAX_AGE_SECONDS } from './constants.js'
import { odbAuthCrypto, dummyPasswordHash } from './crypto.js'
import { odbAuthJwt, jwtSecretOf } from './jwt.js'
import { odbAuthPackage } from './package.js'
import { authSessions, authUsers } from './tables.js'
import { authTypes, type OdbAuthOptions } from './types.js'
/** Installable auth capability plus typed calls into `odb_auth`. Install it after `odbRateLimit`. */
export const odbAuth = {
  toSQLUp(options: { schema?: string } & OdbAuthOptions = {}): string {
    const { schema } = options
    return [
      authUsers.toSQLUp({ schema }),
      authSessions.toSQLUp({ schema }),
      odbAuthCrypto.toSQLUp({ schema }),
      odbAuthJwt.toSQLUp({ schema, substitutions: { jwtSecret: jwtSecretOf(options) } }),
      odbAuthPackage.toSQLUp({
        schema,
        substitutions: { dummyPasswordHash: dummyPasswordHash() },
      }),
    ].join('\n')
  },
  upgrade() {
    return {
      toSQLUp(options: { schema?: string } = {}): string {
        const { schema } = options
        const sessions = qualify('odb_auth_sessions', schema)
        return [
          odbRateLimit.upgrade().toSQLUp({ schema }),
          'BEGIN',
          `  EXECUTE IMMEDIATE 'ALTER TABLE ${sessions} ADD (previous_refresh_token_hash VARCHAR2(128 CHAR))';`,
          'EXCEPTION WHEN OTHERS THEN',
          '  IF SQLCODE != -1430 THEN RAISE; END IF;',
          'END;',
          '/',
          odbAuthPackage.toSQLUp({
            schema,
            substitutions: { dummyPasswordHash: dummyPasswordHash() },
          }),
        ].join('\n')
      },
      toSQLDown() {
        return ''
      },
    }
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [odbAuthPackage, odbAuthJwt, odbAuthCrypto, authSessions, authUsers]
      .map((artifact) => artifact.toSQLDown(options))
      .join('\n')
  },

  /** Parameter types for declaring procedures that pass auth values through, without knowing the tables. */
  types: authTypes,

  /** Lifetime of a refresh token in seconds; use it for transport-level expiry such as cookie Max-Age. */
  refreshTokenMaxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,

  /** `odb_auth.login(<username>, <password>, <accessToken>, <refreshToken>)` with OUT tokens. */
  login(
    username: PlsqlRenderable,
    password: PlsqlRenderable,
    accessToken: PlsqlRenderable,
    refreshToken: PlsqlRenderable,
  ) {
    return odbAuthPackage.login(username, password, accessToken, refreshToken)
  },

  /** `odb_auth.refresh(<refreshToken>, <accessToken>, <nextRefreshToken>)` with OUT tokens. */
  refresh(
    refreshToken: PlsqlRenderable,
    accessToken: PlsqlRenderable,
    nextRefreshToken: PlsqlRenderable,
  ) {
    return odbAuthPackage.refresh(refreshToken, accessToken, nextRefreshToken)
  },

  /** `odb_auth.logout(<refreshToken>)`. */
  logout(refreshToken: PlsqlRenderable) {
    return odbAuthPackage.logout(refreshToken)
  },

  /** `odb_auth.read_user(<userId>, <username>, <displayName>)` with OUT profile fields. */
  readUser(userId: PlsqlRenderable, username: PlsqlRenderable, displayName: PlsqlRenderable) {
    return odbAuthPackage.readUser(userId, username, displayName)
  },

  /** Require a valid access token and return its authenticated user identifier. */
  requireUser(accessToken: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression('VARCHAR2', `odb_auth.require_user(${renderPlsql(accessToken)})`)
  },

  seedUser(user: { username: string; password: string; displayName?: string }) {
    if (!user.username || !user.password)
      throw new Error('odbAuth.seedUser(): username and password are required.')
    return {
      toSQLUp(options: { schema?: string } = {}): string {
        const users = authUsers.as('target')
        const crypto = qualify('odb_auth_crypto', options.schema)
        const passwordHash = plsqlExpr.call(
          'VARCHAR2',
          `${crypto}.hash_password`,
          odbLiteral(user.password),
        )
        const merge = odbQuery()
          .mergeInto(users)
          .using({ username: odbLiteral(user.username) }, 'source')
        const sourceUsername = merge.sourceRef('username')
        merge
          .on((target, source) =>
            cond.eq(odbOracle.lower(target.username), odbOracle.lower(source.username)),
          )
          .whenMatched({
            passwordHash,
            displayName: odbLiteral(user.displayName ?? user.username),
            enabled: true,
            tokenVersion: plsqlExpr.add(users.tokenVersion, 1),
            updatedAt: odbOracle.sysTimestamp(),
          })
          .whenNotMatched({
            username: sourceUsername,
            passwordHash,
            displayName: odbLiteral(user.displayName ?? user.username),
            enabled: true,
            tokenVersion: 0,
          })
        if (options.schema) merge.resolveSchema(options.schema)
        return plsqlBlock(merge.toSQL())
      },
      toSQLDown() {
        return ''
      },
    }
  },
}
