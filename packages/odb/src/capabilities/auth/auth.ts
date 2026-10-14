// Auth capability: users/sessions tables and the `odb_auth` PL/SQL package, defined in TypeScript.
// The package owns password, token and session logic and raises transport-independent ODB errors;
// headers, cookies, HTTP status mapping, ORDS routes and authorization policy belong to the application.

import {
  cond,
  odbLiteral,
  PlsqlExpression,
  plsqlExpr,
  type PlsqlRenderable,
} from '../../schema/attribute.js'
import { plsqlBlock, qualify } from '../../schema/ddl.js'
import { odbQuery } from '../../query/index.js'
import { odbOracle } from '../../oracle/index.js'
import { odbRateLimit } from '../rate-limit/rate-limit.js'
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
      authorizationTablesSQL(schema),
      odbAuthCrypto.toSQLUp({ schema }),
      odbAuthJwt.toSQLUp({ schema }),
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
        const users = qualify('odb_auth_users', schema)
        return [
          odbRateLimit.upgrade().toSQLUp({ schema }),
          'BEGIN',
          `  EXECUTE IMMEDIATE 'ALTER TABLE ${sessions} ADD (previous_refresh_token_hash VARCHAR2(128 CHAR))';`,
          'EXCEPTION WHEN OTHERS THEN',
          '  IF SQLCODE != -1430 THEN RAISE; END IF;',
          'END;',
          '/',
          'DECLARE',
          '  l_nullable VARCHAR2(1);',
          'BEGIN',
          `  SELECT nullable INTO l_nullable FROM all_tab_columns WHERE owner = ${schema ? `'${schema.toUpperCase()}'` : "SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')"} AND table_name = 'ODB_AUTH_USERS' AND column_name = 'PASSWORD_HASH';`,
          "  IF l_nullable = 'N' THEN",
          `    EXECUTE IMMEDIATE 'ALTER TABLE ${users} MODIFY (password_hash NULL)';`,
          '  END IF;',
          'END;',
          '/',
          authorizationTablesSQL(schema, true),
          [authConfirmations, authPasswordResets, authIdentities]
            .map((table) => table.toSQLUp({ schema }))
            .join('\n')
            .split(';')
            .map((statement) => statement.trim())
            .filter(Boolean)
            .map(
              (statement) =>
                `BEGIN EXECUTE IMMEDIATE '${statement.replace(/'/g, "''")}'; EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -2264, -2275) THEN RAISE; END IF; END;\n/`,
            )
            .join('\n'),
          odbAuthJwt.toSQLUp({ schema }),
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
        const store = qualify('odb_settings_store', schema)
        return settings
          .map(({ id, value, meta }) =>
            [
              'DECLARE',
              '  l_count PLS_INTEGER;',
              'BEGIN',
              `  SELECT COUNT(*) INTO l_count FROM ${store} WHERE id = '${id}';`,
              '  IF l_count = 0 THEN',
              `    ${schema ? `${schema}.` : ''}${odbSettings.write(odbLiteral(id), odbLiteral(value), odbLiteral(JSON.stringify(meta))).toSQL()};`,
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
          const pkg = qualify('odb_auth', options.schema)
          return plsqlBlock(
            [
              `${pkg}.define_role(${odbLiteral(role.name).toSQL()}, ${role.description === undefined ? 'NULL' : odbLiteral(role.description).toSQL()})`,
              ...(role.permissions ?? []).map(
                (permission) =>
                  `${pkg}.grant_permission(${odbLiteral(role.name).toSQL()}, ${odbLiteral(permission).toSQL()})`,
              ),
            ].join(';\n'),
          )
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
          const query = odbQuery()
            .selectFrom(authUsers)
            .select(authUsers.id)
            .into('v_user_id')
            .where(
              cond.eq(
                odbOracle.lower(authUsers.username),
                odbOracle.lower(odbLiteral(grant.username)),
              ),
            )
          if (options.schema) query.resolveSchema(options.schema)
          return `DECLARE v_user_id VARCHAR2(32); BEGIN ${query.toSQL()}; ${qualify('odb_auth', options.schema)}.grant_role(v_user_id, ${odbLiteral(grant.role).toSQL()}); END;\n/`
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

function validateName(name: string): void {
  if (!name.trim() || name.length > 200)
    throw new Error('Auth names must contain 1 to 200 characters.')
}

function authorizationTablesSQL(schema?: string, upgrade = false): string {
  const statements = [authRoles, authUserRoles, authRolePermissions].flatMap((table) =>
    table
      .toSQLUp({ schema })
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean),
  )
  return statements
    .map((statement) =>
      upgrade
        ? `BEGIN EXECUTE IMMEDIATE '${statement.replace(/'/g, "''")}'; EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -2264, -2275) THEN RAISE; END IF; END;\n/`
        : `${statement};`,
    )
    .join('\n')
}
