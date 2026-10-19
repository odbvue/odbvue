// Auth capability: users/sessions tables and the `odb_auth` PL/SQL package, defined in TypeScript.
// The package owns password, token and session logic and raises transport-independent ODB errors;
// headers, cookies, HTTP status mapping, ORDS routes and authorization policy belong to the application.

import {
  cond,
  odbLiteral,
  PlsqlExpression,
  PlsqlStatement,
  plsqlExpr,
  type PlsqlRenderable,
} from '../../schema/attribute.js'
import { qualify } from '../../schema/ddl.js'
import { odbBlock, odbType } from '../../schema/package.js'
import { odbQuery } from '../../query/index.js'
import { odbOracle } from '../../oracle/index.js'
import { REFRESH_TOKEN_MAX_AGE_SECONDS } from './constants.js'
import { odbAuthCrypto, dummyPasswordHash } from './crypto.js'
import { odbAuthJwt } from './jwt.js'
import { odbAuthPackage } from './package.js'
import {
  authSessions,
  authUsers,
  authRoles,
  authUserRoles,
  authRolePermissions,
  authConfirmations,
  authPasswordResets,
  authIdentities,
} from './tables.js'
import { authTypes } from './types.js'
import { odbSettings } from '../settings/settings.js'
import { settingsStore } from '../settings/tables.js'
import { authJwtSettings } from './settings.js'
/** Install after `odbRateLimit` and `odbSettings` (which requires `odbAudit`). */
export const odbAuth = {
  toSQLUp(options: { schema?: string } = {}): string {
    const { schema } = options
    return [
      authUsers.toSQLUp({ schema }),
      authIdentities.toSQLUp({ schema }),
      authSessions.toSQLUp({ schema }),
      authConfirmations.toSQLUp({ schema }),
      authPasswordResets.toSQLUp({ schema }),
      ...[authRoles, authUserRoles, authRolePermissions].map((table) => table.toSQLUp({ schema })),
      odbAuthCrypto.toSQLUp({ schema }),
      odbAuthJwt.toSQLUp({ schema }),
      odbAuthPackage.toSQLUp({
        schema,
        substitutions: { dummyPasswordHash: dummyPasswordHash() },
      }),
    ].join('\n')
  },
  /** Seed missing JWT configuration only; provisioning supplies the secret later. */
  seedSettings() {
    const settings = [
      {
        id: 'AUTH_JWT_SECRET',
        value: '',
        meta: { label: 'JWT signing secret', type: 'string', secret: 'Y' as const },
      },
      {
        id: 'AUTH_JWT_ISSUER',
        value: authJwtSettings.defaultIssuer,
        meta: { label: 'JWT issuer', type: 'string' },
      },
      {
        id: 'AUTH_JWT_EXPIRATION_SECONDS',
        value: String(authJwtSettings.defaultExpirationSeconds),
        meta: { label: 'JWT expiration (seconds)', type: 'number' },
      },
    ]
    return {
      toSQLUp({ schema }: { schema?: string } = {}): string {
        return settings
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
              body.ifThen(cond.eq(count, 0), (then) =>
                then.call(
                  qualifyCall(
                    odbSettings.write(
                      odbLiteral(id),
                      odbLiteral(value),
                      odbLiteral(JSON.stringify(meta)),
                    ),
                    schema,
                  ),
                ),
              )
            }),
          )
          .join('\n')
      },
      toSQLDown(): string {
        return ''
      },
    }
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [
      odbAuthPackage,
      odbAuthJwt,
      odbAuthCrypto,
      authRolePermissions,
      authUserRoles,
      authRoles,
      authSessions,
      authConfirmations,
      authPasswordResets,
      authIdentities,
      authUsers,
    ]
      .map((artifact) => artifact.toSQLDown(options))
      .join('\n')
  },

  /** Parameter types for declaring procedures that pass auth values through, without knowing the tables. */
  types: authTypes,

  /** Lifetime of a refresh token in seconds; use it for transport-level expiry such as cookie Max-Age. */
  refreshTokenMaxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,

  /** Creates an inactive account, or retries a pending signup with the same password. */
  signup(
    username: PlsqlRenderable,
    password: PlsqlRenderable,
    displayName: PlsqlRenderable,
    confirmationToken: PlsqlRenderable,
  ) {
    return odbAuthPackage.signup(username, password, displayName, confirmationToken)
  },

  /** Consumes an unexpired confirmation token and enables its account. */
  confirmEmail(token: PlsqlRenderable) {
    return odbAuthPackage.confirmEmail(token)
  },

  /** Returns a fresh recovery token for an enabled account, or NULL for an unknown/disabled one. */
  recoverPassword(username: PlsqlRenderable, resetToken: PlsqlRenderable) {
    return odbAuthPackage.recoverPassword(username, resetToken)
  },

  /** Consumes a recovery token, changes the password, and revokes all existing sessions. */
  resetPassword(token: PlsqlRenderable, password: PlsqlRenderable) {
    return odbAuthPackage.resetPassword(token, password)
  },

  role: {
    has(userId: PlsqlRenderable, role: PlsqlRenderable) {
      return odbAuthPackage.hasRole(userId, role)
    },
    require(userId: PlsqlRenderable, role: PlsqlRenderable) {
      return odbAuthPackage.requireRole(userId, role)
    },
    define(role: PlsqlRenderable, description: PlsqlRenderable = odbOracle.null()) {
      return odbAuthPackage.defineRole(role, description)
    },
    grant(
      userId: PlsqlRenderable,
      role: PlsqlRenderable,
      options: { validFrom?: PlsqlRenderable; validTo?: PlsqlRenderable } = {},
    ) {
      return odbAuthPackage.grantRole(
        userId,
        role,
        options.validFrom ?? odbOracle.sysTimestamp(),
        options.validTo ?? odbOracle.null(),
      )
    },
    revoke(userId: PlsqlRenderable, role: PlsqlRenderable) {
      return odbAuthPackage.revokeRole(userId, role)
    },
    seed(role: { name: string; description?: string; permissions?: readonly string[] }) {
      validateName(role.name)
      role.permissions?.forEach(validateName)
      return {
        toSQLUp(options: { schema?: string } = {}) {
          return odbBlock((body) => {
            body.call(
              qualifyCall(
                odbAuthPackage.defineRole(
                  odbLiteral(role.name),
                  role.description === undefined ? odbOracle.null() : odbLiteral(role.description),
                ),
                options.schema,
              ),
            )
            for (const permission of role.permissions ?? [])
              body.call(
                qualifyCall(
                  odbAuthPackage.grantPermission(odbLiteral(role.name), odbLiteral(permission)),
                  options.schema,
                ),
              )
          })
        },
        toSQLDown() {
          return ''
        },
      }
    },
    seedGrant(grant: { username: string; role: string }) {
      validateName(grant.role)
      if (!grant.username.trim()) throw new Error('odbAuth.role.seedGrant(): username is required.')
      return {
        toSQLUp(options: { schema?: string } = {}) {
          return odbBlock((body) => {
            const { userId } = body.variables({ userId: authTypes.userId })
            const query = odbQuery()
              .selectFrom(authUsers)
              .select(authUsers.id)
              .into(userId)
              .where(
                cond.eq(
                  odbOracle.lower(authUsers.username),
                  odbOracle.lower(odbLiteral(grant.username)),
                ),
              )
            if (options.schema) query.resolveSchema(options.schema)
            body.query(query)
            body.call(
              qualifyCall(
                odbAuthPackage.grantRole(
                  userId,
                  odbLiteral(grant.role),
                  odbOracle.sysTimestamp(),
                  odbOracle.null(),
                ),
                options.schema,
              ),
            )
          })
        },
        toSQLDown() {
          return ''
        },
      }
    },
  },

  permission: {
    has(userId: PlsqlRenderable, permission: PlsqlRenderable) {
      return odbAuthPackage.hasPermission(userId, permission)
    },
    require(userId: PlsqlRenderable, permission: PlsqlRenderable) {
      return odbAuthPackage.requirePermission(userId, permission)
    },
    grant(role: PlsqlRenderable, permission: PlsqlRenderable) {
      return odbAuthPackage.grantPermission(role, permission)
    },
    revoke(role: PlsqlRenderable, permission: PlsqlRenderable) {
      return odbAuthPackage.revokePermission(role, permission)
    },
  },

  /** `odb_auth.login(<username>, <password>, <accessToken>, <refreshToken>)` with OUT tokens. */
  login(
    username: PlsqlRenderable,
    password: PlsqlRenderable,
    accessToken: PlsqlRenderable,
    refreshToken: PlsqlRenderable,
  ) {
    return odbAuthPackage.login(username, password, accessToken, refreshToken)
  },

  /** Trusted server-only entry point; the caller must verify Google's token and transaction first. */
  loginGoogle(
    subject: PlsqlRenderable,
    email: PlsqlRenderable,
    displayName: PlsqlRenderable,
    accessToken: PlsqlRenderable,
    refreshToken: PlsqlRenderable,
  ) {
    return odbAuthPackage.loginGoogle(subject, email, displayName, accessToken, refreshToken)
  },

  prepareGoogleLink(
    userId: PlsqlRenderable,
    refreshToken: PlsqlRenderable,
    password: PlsqlRenderable,
    sessionId: PlsqlRenderable,
    tokenVersion: PlsqlRenderable,
  ) {
    return odbAuthPackage.prepareGoogleLink(userId, refreshToken, password, sessionId, tokenVersion)
  },
  checkGoogleLink(
    userId: PlsqlRenderable,
    sessionId: PlsqlRenderable,
    tokenVersion: PlsqlRenderable,
    refreshToken: PlsqlRenderable,
  ) {
    return odbAuthPackage.checkGoogleLink(userId, sessionId, tokenVersion, refreshToken)
  },
  /** Server-only: Google subject must already have passed OIDC and transaction verification. */
  linkGoogle(
    userId: PlsqlRenderable,
    sessionId: PlsqlRenderable,
    tokenVersion: PlsqlRenderable,
    refreshToken: PlsqlRenderable,
    subject: PlsqlRenderable,
  ) {
    return odbAuthPackage.linkGoogle(userId, sessionId, tokenVersion, refreshToken, subject)
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

  readAuthorization(userId: PlsqlRenderable, roles: PlsqlRenderable, permissions: PlsqlRenderable) {
    return odbAuthPackage.readAuthorization(userId, roles, permissions)
  },

  /** Require a valid access token and return its authenticated user identifier. */
  requireUser(accessToken: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return odbAuthPackage.requireUser(accessToken)
  },

  seedUser(user: { username: string; password: string; displayName?: string }) {
    if (!user.username || !user.password)
      throw new Error('odbAuth.seedUser(): username and password are required.')
    return {
      toSQLUp(options: { schema?: string } = {}): string {
        return odbBlock((body) => {
          const { userId } = body.variables({ userId: authTypes.userId })
          const users = authUsers.as('target')
          const crypto = qualify('odb_auth_crypto', options.schema)
          const passwordHash = plsqlExpr.call(
            'VARCHAR2',
            `${crypto}.hash_password`,
            odbLiteral(user.password),
          )
          const merge = odbQuery()
            .mergeInto(users)
            .using({ username: odbLiteral(user.username.trim().toLowerCase()) }, 'source')
          const sourceUsername = merge.sourceRef('username')
          merge
            .on((target, source) =>
              cond.eq(odbOracle.lower(odbOracle.trim(target.username)), source.username),
            )
            .whenMatched({
              displayName: odbLiteral(user.displayName ?? user.username),
              enabled: true,
              tokenVersion: plsqlExpr.add(users.tokenVersion, 1),
              updatedAt: odbOracle.sysTimestamp(),
            })
            .whenNotMatched({
              username: sourceUsername,
              displayName: odbLiteral(user.displayName ?? user.username),
              enabled: true,
              tokenVersion: 0,
            })
          if (options.schema) merge.resolveSchema(options.schema)
          const selectUser = odbQuery()
            .selectFrom(authUsers)
            .select(authUsers.id)
            .into(userId)
            .where(
              cond.eq(
                odbOracle.lower(odbOracle.trim(authUsers.username)),
                user.username.trim().toLowerCase(),
              ),
            )
          const credential = odbQuery()
            .mergeInto(authIdentities.as('target'))
            .using({ userId }, 'source')
            .on((target, source) =>
              cond.and([cond.eq(target.issuer, 'password'), cond.eq(target.userId, source.userId)]),
            )
            .whenMatched({ passwordHash })
            .whenNotMatched({
              issuer: 'password',
              subject: user.username.trim().toLowerCase(),
              userId,
              passwordHash,
            })
          if (options.schema) {
            selectUser.resolveSchema(options.schema)
            credential.resolveSchema(options.schema)
          }
          body.query(merge)
          body.query(selectUser)
          body.query(credential)
        })
      },
      toSQLDown() {
        return ''
      },
    }
  },
}

function validateName(name: string): void {
  if (!name.trim() || name.length > 200)
    throw new Error('Auth names must contain 1 to 200 characters.')
}

function qualifyCall(statement: PlsqlStatement, schema?: string): PlsqlStatement {
  return schema
    ? new PlsqlStatement(`${schema}.${statement.toSQL()}`, statement.cursors)
    : statement
}
