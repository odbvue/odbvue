import { odbPackage, odbType } from '../../schema/package.js'
import { cond, odbLiteral, PlsqlExpression, PlsqlStatement } from '../../schema/attribute.js'
import { odbQuery } from '../../query/index.js'
import { odbOracle } from '../../oracle/index.js'
import { odbRateLimitApi } from '../rate-limit/rate-limit.js'
import { REFRESH_TOKEN_BYTES, REFRESH_TOKEN_DAYS } from './constants.js'
import { odbAuthCrypto } from './crypto.js'
import { odbAuthJwt } from './jwt.js'
import {
  authSessions,
  authUsers,
  authRoles,
  authUserRoles,
  authRolePermissions,
  authConfirmations,
} from './tables.js'
import { authTypes } from './types.js'

/**
 * PL/SQL API for authentication. Tokens go in and out as plain values: the caller decides how
 * they travel (headers, cookies, bodies) and what a failure looks like on the wire.
 * Refresh tokens never enter access JWTs.
 */
export const odbAuthPackage = odbPackage('odb_auth', (pkg) => {
  const dummyPasswordHashConstant = pkg.privateConstant(
    'c_dummy_password_hash',
    odbType.string(512),
    'dummyPasswordHash',
  )

  const signup = pkg.proc(
    'signup',
    {
      in: {
        username: authTypes.username,
        password: authTypes.password,
        displayName: authTypes.displayName,
      },
      out: { confirmationToken: odbType.string(64) },
    },
    ({ params: { username, password, displayName, confirmationToken }, body }) => {
      const { email, userId, passwordHash, enabled, pending } = body.variables({
        email: authUsers.username,
        userId: authUsers.id,
        passwordHash: authUsers.passwordHash,
        enabled: authUsers.enabled,
        pending: odbType.integer(),
      })
      body.ifThen(
        cond.or([
          cond.isNull(odbOracle.trim(username)),
          cond.gt(odbOracle.length(odbOracle.trim(username)), 128),
          cond.not(
            cond.regexpLike(
              odbOracle.trim(username),
              '^[^[:space:]@]+@[^[:space:]@.]+([.][^[:space:]@.]+)+$',
            ),
          ),
        ]),
        (then) => then.invalid('SIGNUP_EMAIL_INVALID'),
      )
      body.set(email, odbOracle.lower(odbOracle.trim(username)))
      body.ifThen(
        cond.or([
          cond.isNull(odbOracle.trim(displayName)),
          cond.gt(odbOracle.length(odbOracle.trim(displayName)), 256),
        ]),
        (then) => then.invalid('SIGNUP_NAME_INVALID'),
      )
      body.ifThen(
        cond.or([
          cond.isNull(password),
          cond.lt(odbOracle.length(password), 8),
          cond.gt(odbOracle.length(password), 256),
        ]),
        (then) => then.invalid('SIGNUP_PASSWORD_INVALID'),
      )
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_SIGNUP_EMAIL'), email))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_SIGNUP_EMAIL'), email))
      body.block((inner) => {
        inner.query(
          odbQuery()
            .selectFrom(authUsers)
            .select([authUsers.id, authUsers.passwordHash, authUsers.enabled])
            .into(userId, passwordHash, enabled)
            .where(cond.eq(odbOracle.lower(authUsers.username), email))
            .forUpdate(),
        )
        inner.query(
          odbQuery()
            .selectFrom(authConfirmations)
            .select('COUNT(*)')
            .into(pending)
            .where(cond.eq(authConfirmations.userId, userId)),
        )
        inner.ifThen(
          cond.or([
            cond.eq(enabled, 1),
            cond.eq(pending, 0),
            cond.eq(odbAuthCrypto.verifyPassword(password, passwordHash), false),
          ]),
          (then) => then.conflict('SIGNUP_EMAIL_EXISTS'),
        )
        inner.when('NO_DATA_FOUND', (handler) => {
          handler.set(userId, odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid())))
          handler.insertInto(authUsers, {
            id: userId,
            username: email,
            passwordHash: odbAuthCrypto.hashPassword(password),
            displayName: odbOracle.trim(displayName),
            enabled: false,
          })
        })
      })
      body.set(confirmationToken, odbAuthCrypto.randomToken(odbLiteral(32)))
      body.query(
        odbQuery()
          .mergeInto(authConfirmations.as('target'))
          .using({ userId }, 'source')
          .on((target, source) => cond.eq(target.userId, source.userId))
          .whenMatched({
            tokenHash: odbAuthCrypto.hashToken(confirmationToken),
            expiresAt: odbOracle.plus(odbOracle.sysTimestamp(), odbOracle.interval.days(1)),
          })
          .whenNotMatched({
            userId,
            tokenHash: odbAuthCrypto.hashToken(confirmationToken),
            expiresAt: odbOracle.plus(odbOracle.sysTimestamp(), odbOracle.interval.days(1)),
          }),
      )
      body.when('DUP_VAL_ON_INDEX', (handler) => handler.conflict('SIGNUP_EMAIL_EXISTS'))
    },
  )

  const confirmEmail = pkg.proc(
    'confirm_email',
    { in: { token: odbType.string(64) } },
    ({ params: { token }, body }) => {
      const { userId, lockedUserId } = body.variables({
        userId: authUsers.id,
        lockedUserId: authUsers.id,
      })
      body.ifThen(
        cond.or([cond.isNull(token), cond.not(cond.regexpLike(token, '^[A-F0-9]{64}$'))]),
        (then) => then.invalid('CONFIRMATION_INVALID'),
      )
      const validToken = () =>
        cond.and([
          cond.eq(authConfirmations.tokenHash, odbAuthCrypto.hashToken(token)),
          cond.gt(
            authConfirmations.expiresAt,
            new PlsqlExpression('TIMESTAMP', 'CAST(SYSTIMESTAMP AS TIMESTAMP)'),
          ),
        ])
      body.query(
        odbQuery()
          .selectFrom(authConfirmations)
          .select(authConfirmations.userId)
          .into(userId)
          .where(validToken()),
      )
      // Lock the user first, as signup does, then recheck the token after any concurrent retry.
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.id)
          .into(lockedUserId)
          .where(cond.eq(authUsers.id, userId))
          .forUpdate(),
      )
      body.query(
        odbQuery()
          .selectFrom(authConfirmations)
          .select(authConfirmations.userId)
          .into(userId)
          .where(validToken())
          .forUpdate(),
      )
      body.query(
        odbQuery()
          .updateTable(authUsers)
          .set({ enabled: true, updatedAt: odbOracle.sysTimestamp() })
          .where(cond.eq(authUsers.id, userId)),
      )
      body.query(
        odbQuery().deleteFrom(authConfirmations).where(cond.eq(authConfirmations.userId, userId)),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.invalid('CONFIRMATION_INVALID'))
    },
  )

  /** Verifies credentials and opens a session; raises UNAUTHORIZED (`INVALID_CREDENTIALS`) on failure. */
  const login = pkg.proc(
    'login',
    {
      in: { username: authUsers.username, password: authTypes.password },
      out: { accessToken: authTypes.accessToken, refreshToken: authTypes.refreshToken },
    },
    ({ params: { username, password, accessToken, refreshToken }, body: statements }) => {
      const { userId, passwordHash, tokenVersion, sessionId, newRefreshToken, loginSubject } =
        statements.variables({
          userId: authUsers.id,
          passwordHash: authUsers.passwordHash,
          tokenVersion: authUsers.tokenVersion,
          sessionId: authSessions.id,
          newRefreshToken: authTypes.refreshToken,
          loginSubject: odbType.string(128),
        })
      statements.set(loginSubject, odbOracle.lower(odbOracle.trim(username)))
      statements.call(odbRateLimitApi.enforce(odbLiteral('AUTH_LOGIN_USERNAME'), loginSubject))
      statements.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(['MAX(id)', 'MAX(password_hash)', 'MAX(token_version)'])
          .into(userId, passwordHash, tokenVersion)
          .where(
            cond.and([
              cond.eq(odbOracle.lower(authUsers.username), odbOracle.lower(username)),
              cond.eq(authUsers.enabled, true),
            ]),
          ),
      )
      statements.set(passwordHash, odbOracle.nvl(passwordHash, dummyPasswordHashConstant))
      statements.ifThen(
        cond.or([
          cond.eq(odbAuthCrypto.verifyPassword(password, passwordHash), false),
          cond.isNull(userId),
        ]),
        (then) => {
          then.call(odbRateLimitApi.failure(odbLiteral('AUTH_LOGIN_USERNAME'), loginSubject))
          then.unauthorized('INVALID_CREDENTIALS')
        },
      )
      statements.call(odbRateLimitApi.success(odbLiteral('AUTH_LOGIN_USERNAME'), loginSubject))
      statements.set(sessionId, odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid())))
      statements.set(newRefreshToken, odbAuthCrypto.randomToken(odbLiteral(REFRESH_TOKEN_BYTES)))
      statements.insertInto(authSessions, {
        id: sessionId,
        userId,
        refreshTokenHash: odbAuthCrypto.hashToken(newRefreshToken),
        expiresAt: odbOracle.plus(
          odbOracle.sysTimestamp(),
          odbOracle.interval.days(REFRESH_TOKEN_DAYS),
        ),
      })
      statements.set(accessToken, odbAuthJwt.createAccessToken(userId, sessionId, tokenVersion))
      statements.set(refreshToken, newRefreshToken)
      statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized('INVALID_CREDENTIALS'))
    },
  )

  /** Rotates a refresh token and issues a new access token; reuse of a rotated token revokes the session. */
  const refresh = pkg.proc(
    'refresh',
    {
      in: { refreshToken: authTypes.refreshToken },
      out: { accessToken: authTypes.accessToken, nextRefreshToken: authTypes.refreshToken },
    },
    ({ params: { refreshToken, accessToken, nextRefreshToken }, body: statements }) => {
      const {
        sessionId,
        userId,
        tokenVersion,
        previousRefreshTokenHash,
        presentedRefreshTokenHash,
      } = statements.variables({
        sessionId: authSessions.id,
        userId: authUsers.id,
        tokenVersion: authUsers.tokenVersion,
        previousRefreshTokenHash: authSessions.previousRefreshTokenHash,
        presentedRefreshTokenHash: authSessions.refreshTokenHash,
      })
      const { newRefreshToken } = statements.variables({ newRefreshToken: authTypes.refreshToken })
      statements.ifThen(
        cond.or([
          cond.isNull(refreshToken),
          cond.not(cond.regexpLike(refreshToken, '^[[:xdigit:]]{128}$')),
        ]),
        (then) => then.unauthorized(),
      )
      statements.set(presentedRefreshTokenHash, odbAuthCrypto.hashToken(refreshToken))
      const sessions = authSessions.as('s')
      statements.query(
        odbQuery()
          .selectFrom(sessions)
          .select([sessions.id, sessions.userId, sessions.previousRefreshTokenHash])
          .into(sessionId, userId, previousRefreshTokenHash)
          .where(
            cond.and([
              cond.or([
                cond.eq(sessions.refreshTokenHash, presentedRefreshTokenHash),
                cond.eq(sessions.previousRefreshTokenHash, presentedRefreshTokenHash),
              ]),
              cond.isNull(sessions.revokedAt),
              cond.gt(sessions.expiresAt, odbOracle.sysTimestamp()),
            ]),
          )
          .forUpdate(),
      )
      statements.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.tokenVersion)
          .into(tokenVersion)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)])),
      )
      statements.ifThen(cond.eq(presentedRefreshTokenHash, previousRefreshTokenHash), (then) => {
        then.query(
          odbQuery()
            .updateTable(authSessions)
            .set({ revokedAt: odbOracle.sysTimestamp() })
            .where(cond.eq(authSessions.id, sessionId)),
        )
        then.unauthorized()
      })
      statements.set(newRefreshToken, odbAuthCrypto.randomToken(odbLiteral(REFRESH_TOKEN_BYTES)))
      statements.query(
        odbQuery()
          .updateTable(authSessions)
          .set({
            previousRefreshTokenHash: presentedRefreshTokenHash,
            refreshTokenHash: odbAuthCrypto.hashToken(newRefreshToken),
            lastUsedAt: odbOracle.sysTimestamp(),
          })
          .where(cond.eq(authSessions.id, sessionId)),
      )
      statements.set(accessToken, odbAuthJwt.createAccessToken(userId, sessionId, tokenVersion))
      statements.set(nextRefreshToken, newRefreshToken)
      statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized())
    },
  )

  /** Revokes the session holding the refresh token; unknown or empty tokens are ignored. */
  const logout = pkg.proc(
    'logout',
    { in: { refreshToken: authTypes.refreshToken } },
    ({ params: { refreshToken }, body: statements }) => {
      statements.ifThen(cond.isNotNull(refreshToken), (then) =>
        then.query(
          odbQuery()
            .updateTable(authSessions)
            .set({ revokedAt: odbOracle.sysTimestamp() })
            .where(
              cond.and([
                cond.eq(authSessions.refreshTokenHash, odbAuthCrypto.hashToken(refreshToken)),
                cond.isNull(authSessions.revokedAt),
              ]),
            ),
        ),
      )
    },
  )

  /** Returns the user id behind a valid access token; raises UNAUTHORIZED otherwise. */
  const requireUser = pkg.func('require_user', authTypes.userId, (fn) => {
    const { accessToken } = fn.parameters({ in: { accessToken: authTypes.accessToken } })
    fn.body((body) => body.return(odbAuthJwt.requireUser(accessToken)))
  })

  /** Reads an enabled user's profile; raises NOT_FOUND when the user does not exist. */
  const readUser = pkg.proc(
    'read_user',
    {
      in: { userId: authUsers.id },
      out: { username: authUsers.username, displayName: authUsers.displayName },
    },
    ({ params: { userId, username, displayName }, body: statements }) => {
      statements.query(
        odbQuery()
          .selectFrom(authUsers)
          .select([authUsers.username, authUsers.displayName])
          .into(username, displayName)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)])),
      )
      statements.when('NO_DATA_FOUND', (handler) => handler.notFound())
    },
  )

  const defineRole = pkg.proc(
    'define_role',
    {
      in: { role: authRoles.role, description: { ...odbType.string(2000), default: 'NULL' } },
    },
    ({ params: { role, description }, body }) => {
      body.ifThen(cond.isNull(odbOracle.trim(role)), (then) => then.invalid('ROLE_REQUIRED'))
      body.query(
        odbQuery()
          .mergeInto(authRoles.as('target'))
          .using({ role }, 'source')
          .on((target, source) => cond.eq(target.role, source.role))
          .whenMatched({ description })
          .whenNotMatched({ role, description }),
      )
    },
  )

  const grantRole = pkg.proc(
    'grant_role',
    {
      in: {
        userId: authUsers.id,
        role: authRoles.role,
        validFrom: { ...odbType.timestamp(), default: 'SYSTIMESTAMP' },
        validTo: { ...odbType.timestamp(), default: 'NULL' },
      },
    },
    ({ params: { userId, role, validFrom, validTo }, body }) => {
      body.query(
        odbQuery()
          .mergeInto(authUserRoles.as('target'))
          .using({ userId, role }, 'source')
          .on((target, source) =>
            cond.and([cond.eq(target.userId, source.userId), cond.eq(target.role, source.role)]),
          )
          .whenMatched({ validFrom, validTo })
          .whenNotMatched({ userId, role, validFrom, validTo }),
      )
    },
  )

  const revokeRole = pkg.proc(
    'revoke_role',
    { in: { userId: authUsers.id, role: authRoles.role } },
    ({ params: { userId, role }, body }) =>
      body.query(
        odbQuery()
          .deleteFrom(authUserRoles)
          .where(
            cond.and([cond.eq(authUserRoles.userId, userId), cond.eq(authUserRoles.role, role)]),
          ),
      ),
  )

  const grantPermission = pkg.proc(
    'grant_permission',
    {
      in: { role: authRoles.role, permission: authRolePermissions.permission },
    },
    ({ params: { role, permission }, body }) => {
      body.ifThen(cond.isNull(odbOracle.trim(permission)), (then) =>
        then.invalid('PERMISSION_REQUIRED'),
      )
      body.query(
        odbQuery()
          .mergeInto(authRolePermissions.as('target'))
          .using({ role, permission }, 'source')
          .on((target, source) =>
            cond.and([
              cond.eq(target.role, source.role),
              cond.eq(target.permission, source.permission),
            ]),
          )
          .whenNotMatched({ role, permission }),
      )
    },
  )

  const revokePermission = pkg.proc(
    'revoke_permission',
    {
      in: { role: authRoles.role, permission: authRolePermissions.permission },
    },
    ({ params: { role, permission }, body }) =>
      body.query(
        odbQuery()
          .deleteFrom(authRolePermissions)
          .where(
            cond.and([
              cond.eq(authRolePermissions.role, role),
              cond.eq(authRolePermissions.permission, permission),
            ]),
          ),
      ),
  )

  const users = authUsers.as('u')
  const userRoles = authUserRoles.as('ur')
  const rolePermissions = authRolePermissions.as('rp')
  const activeGrant = () =>
    cond.and([
      cond.eq(users.enabled, true),
      cond.lte(userRoles.validFrom, odbOracle.sysTimestamp()),
      cond.or([
        cond.isNull(userRoles.validTo),
        cond.gt(userRoles.validTo, odbOracle.sysTimestamp()),
      ]),
    ])

  const hasRole = pkg.func('has_role', odbType.boolean(), (fn) => {
    const { userId, role } = fn.parameters({ in: { userId: authUsers.id, role: authRoles.role } })
    fn.body((body) => {
      const { count } = body.variables({ count: odbType.integer() })
      body.query(
        odbQuery()
          .selectFrom(userRoles)
          .join(users, cond.eq(users.id, userRoles.userId))
          .select('COUNT(*)')
          .into(count)
          .where(
            cond.and([
              cond.eq(userRoles.userId, userId),
              cond.eq(userRoles.role, role),
              activeGrant(),
            ]),
          ),
      )
      body.return(cond.gt(count, 0))
    })
  })

  const hasPermission = pkg.func('has_permission', odbType.boolean(), (fn) => {
    const { userId, permission } = fn.parameters({
      in: { userId: authUsers.id, permission: authRolePermissions.permission },
    })
    fn.body((body) => {
      const { count } = body.variables({ count: odbType.integer() })
      body.query(
        odbQuery()
          .selectFrom(userRoles)
          .join(users, cond.eq(users.id, userRoles.userId))
          .join(rolePermissions, cond.eq(rolePermissions.role, userRoles.role))
          .select('COUNT(*)')
          .into(count)
          .where(
            cond.and([
              cond.eq(userRoles.userId, userId),
              cond.eq(rolePermissions.permission, permission),
              activeGrant(),
            ]),
          ),
      )
      body.return(cond.gt(count, 0))
    })
  })

  const requireRole = pkg.proc(
    'require_role',
    { in: { userId: authUsers.id, role: authRoles.role } },
    ({ params: { userId, role }, body }) =>
      body.ifThen(cond.eq(hasRole.invoke(userId, role), false), (then) => then.forbidden()),
  )
  const requirePermission = pkg.proc(
    'require_permission',
    { in: { userId: authUsers.id, permission: authRolePermissions.permission } },
    ({ params: { userId, permission }, body }) =>
      body.ifThen(cond.eq(hasPermission.invoke(userId, permission), false), (then) =>
        then.forbidden(),
      ),
  )

  const readAuthorization = pkg.proc(
    'read_authorization',
    {
      in: { userId: authUsers.id },
      out: { roles: odbType.json(), permissions: odbType.json() },
    },
    ({ params: { userId, roles, permissions }, body }) => {
      body.query(
        odbQuery()
          .selectFrom(userRoles)
          .join(users, cond.eq(users.id, userRoles.userId))
          .select("COALESCE(JSON_ARRAYAGG(ur.role ORDER BY ur.role RETURNING CLOB), TO_CLOB('[]'))")
          .into(roles)
          .where(cond.and([cond.eq(userRoles.userId, userId), activeGrant()])),
      )
      const { permissionArray } = body.variables({
        permissionArray: odbType.custom('json_array_t'),
      })
      body.set(permissionArray, new PlsqlExpression('json_array_t', 'json_array_t()'))
      body.forQuery(
        'permission_row',
        odbQuery()
          .selectFrom(userRoles)
          .join(users, cond.eq(users.id, userRoles.userId))
          .join(rolePermissions, cond.eq(rolePermissions.role, userRoles.role))
          .select('DISTINCT rp.permission')
          .where(cond.and([cond.eq(userRoles.userId, userId), activeGrant()]))
          .orderBy(rolePermissions.permission),
        (record, loop) => {
          loop.call(
            new PlsqlStatement(
              `${permissionArray.toSQL()}.append(${record.column('permission').toSQL()})`,
            ),
          )
        },
      )
      body.set(permissions, `${permissionArray.toSQL()}.to_clob()`)
    },
  )

  return {
    signup,
    confirmEmail,
    login,
    refresh,
    logout,
    requireUser,
    readUser,
    defineRole,
    grantRole,
    revokeRole,
    grantPermission,
    revokePermission,
    hasRole,
    hasPermission,
    requireRole,
    requirePermission,
    readAuthorization,
  }
})
