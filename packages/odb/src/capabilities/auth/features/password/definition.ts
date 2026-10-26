import { type PackageImpl, odbType } from '../../../../schema/package.js'
import { cond, odbLiteral, plsqlExpr, PlsqlExpression } from '../../../../schema/attribute.js'
import { odbQuery } from '../../../../query/index.js'
import { odbOracle } from '../../../../oracle/index.js'
import { odbRateLimitApi } from '../../../rate-limit/rate-limit.js'
import { odbAuthCrypto } from '../../core/crypto.js'
import { authTypes } from '../../core/types.js'
import { authUsers } from '../../core/tables/users.js'
import { authIdentities } from '../../core/tables/identities.js'
import { authSessions } from '../../core/tables/sessions.js'
import { authPasswordResets } from './tables.js'
import { authChallenges } from '../two-factor/tables.js'
import type { defineAuthPolicy } from '../../core/policy.js'
import type { defineAuthIdentities } from '../../core/identities.js'

export function defineAuthPassword(
  pkg: PackageImpl,
  {
    featureEnabled,
    readPasswordHash,
  }: {
    featureEnabled: ReturnType<typeof defineAuthPolicy>['featureEnabled']
    readPasswordHash: ReturnType<typeof defineAuthIdentities>['readPasswordHash']
  },
) {
  const recoverPassword = pkg.proc(
    'recover_password',
    { in: { username: authTypes.username }, out: { resetToken: odbType.string(64) } },
    ({ params: { username, resetToken }, body }) => {
      body.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('password')), false), (denied) =>
        denied.forbidden('PASSWORD_DISABLED'),
      )
      const { email, userId } = body.variables({
        email: authUsers.username,
        userId: authUsers.id,
      })
      body.set(resetToken, odbOracle.null())
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
        (then) => then.invalid('RECOVERY_EMAIL_INVALID'),
      )
      body.set(email, odbOracle.lower(odbOracle.trim(username)))
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_RECOVERY_EMAIL'), email))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_RECOVERY_EMAIL'), email))
      body.block((inner) => {
        inner.query(
          odbQuery()
            .selectFrom(authUsers)
            .select(authUsers.id)
            .into(userId)
            .where(
              cond.and([
                cond.eq(odbOracle.lower(odbOracle.trim(authUsers.username)), email),
                cond.eq(authUsers.enabled, true),
              ]),
            )
            .forUpdate(),
        )
        inner.ifThen(cond.isNull(readPasswordHash.invoke(userId)), (then) => then.return())
        inner.when('NO_DATA_FOUND', (handler) => handler.return())
      })
      body.set(resetToken, odbAuthCrypto.randomToken(odbLiteral(32)))
      body.query(
        odbQuery()
          .mergeInto(authPasswordResets.as('target'))
          .using({ userId }, 'source')
          .on((target, source) => cond.eq(target.userId, source.userId))
          .whenMatched({
            tokenHash: odbAuthCrypto.hashToken(resetToken),
            expiresAt: odbOracle.plus(odbOracle.sysTimestamp(), odbOracle.interval.seconds(3600)),
          })
          .whenNotMatched({
            userId,
            tokenHash: odbAuthCrypto.hashToken(resetToken),
            expiresAt: odbOracle.plus(odbOracle.sysTimestamp(), odbOracle.interval.seconds(3600)),
          }),
      )
    },
  )

  const resetPassword = pkg.proc(
    'reset_password',
    { in: { token: odbType.string(64), password: authTypes.password } },
    ({ params: { token, password }, body }) => {
      body.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('password')), false), (denied) =>
        denied.forbidden('PASSWORD_DISABLED'),
      )
      const { userId, lockedUserId, email } = body.variables({
        userId: authUsers.id,
        lockedUserId: authUsers.id,
        email: authUsers.username,
      })
      body.ifThen(
        cond.or([cond.isNull(token), cond.not(cond.regexpLike(token, '^[A-F0-9]{64}$'))]),
        (then) => then.invalid('PASSWORD_RESET_INVALID'),
      )
      body.ifThen(
        cond.or([
          cond.isNull(password),
          cond.lt(odbOracle.length(password), 8),
          cond.gt(odbOracle.length(password), 256),
        ]),
        (then) => then.invalid('PASSWORD_RESET_PASSWORD_INVALID'),
      )
      const validToken = () =>
        cond.and([
          cond.eq(authPasswordResets.tokenHash, odbAuthCrypto.hashToken(token)),
          cond.gt(
            authPasswordResets.expiresAt,
            new PlsqlExpression('TIMESTAMP', 'CAST(SYSTIMESTAMP AS TIMESTAMP)'),
          ),
        ])
      body.query(
        odbQuery()
          .selectFrom(authPasswordResets)
          .select(authPasswordResets.userId)
          .into(userId)
          .where(validToken()),
      )
      // Match recovery's lock order, then recheck the token after concurrent retries/resets.
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select([authUsers.id, authUsers.username])
          .into(lockedUserId, email)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)]))
          .forUpdate(),
      )
      body.ifThen(cond.isNull(readPasswordHash.invoke(userId)), (then) =>
        then.invalid('PASSWORD_RESET_INVALID'),
      )
      body.query(
        odbQuery()
          .selectFrom(authPasswordResets)
          .select(authPasswordResets.userId)
          .into(userId)
          .where(validToken())
          .forUpdate(),
      )
      body.query(
        odbQuery()
          .updateTable(authUsers)
          .set({
            tokenVersion: plsqlExpr.add(authUsers.tokenVersion, 1),
            updatedAt: odbOracle.sysTimestamp(),
          })
          .where(cond.eq(authUsers.id, userId)),
      )
      body.query(
        odbQuery()
          .updateTable(authIdentities)
          .set({ passwordHash: odbAuthCrypto.hashPassword(password) })
          .where(
            cond.and([
              cond.eq(authIdentities.userId, userId),
              cond.eq(authIdentities.issuer, 'password'),
            ]),
          ),
      )
      body.query(
        odbQuery()
          .updateTable(authSessions)
          .set({ revokedAt: odbOracle.sysTimestamp() })
          .where(
            cond.and([cond.eq(authSessions.userId, userId), cond.isNull(authSessions.revokedAt)]),
          ),
      )
      body.query(
        odbQuery().deleteFrom(authPasswordResets).where(cond.eq(authPasswordResets.userId, userId)),
      )
      body.query(
        odbQuery().deleteFrom(authChallenges).where(cond.eq(authChallenges.userId, userId)),
      )
      body.call(odbRateLimitApi.success(odbLiteral('AUTH_LOGIN_USERNAME'), odbOracle.lower(email)))
      body.when('NO_DATA_FOUND', (handler) => handler.invalid('PASSWORD_RESET_INVALID'))
    },
  )

  const changePassword = pkg.proc(
    'change_password',
    {
      in: {
        userId: authUsers.id,
        currentPassword: authTypes.password,
        password: authTypes.password,
      },
    },
    ({ params: { userId, currentPassword, password }, body }) => {
      body.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('password')), false), (denied) =>
        denied.forbidden('PASSWORD_DISABLED'),
      )
      const { lockedUserId, passwordHash } = body.variables({
        lockedUserId: authUsers.id,
        passwordHash: authIdentities.passwordHash,
      })
      body.ifThen(
        cond.or([
          cond.isNull(password),
          cond.lt(odbOracle.length(password), 8),
          cond.gt(odbOracle.length(password), 256),
        ]),
        (then) => then.invalid('PASSWORD_CHANGE_PASSWORD_INVALID'),
      )
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_PASSWORD_CHANGE_USER'), userId))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_PASSWORD_CHANGE_USER'), userId))
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.id)
          .into(lockedUserId)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)]))
          .forUpdate(),
      )
      body.set(passwordHash, readPasswordHash.invoke(userId))
      body.ifThen(cond.isNull(passwordHash), (then) => then.conflict('PASSWORD_NOT_CONNECTED'))
      body.ifThen(
        cond.or([
          cond.isNull(currentPassword),
          cond.gt(odbOracle.length(currentPassword), 256),
          cond.eq(odbAuthCrypto.verifyPassword(currentPassword, passwordHash), false),
        ]),
        (then) => then.forbidden('PASSWORD_CHANGE_CURRENT_INVALID'),
      )
      body.query(
        odbQuery()
          .updateTable(authIdentities)
          .set({ passwordHash: odbAuthCrypto.hashPassword(password) })
          .where(
            cond.and([
              cond.eq(authIdentities.userId, userId),
              cond.eq(authIdentities.issuer, 'password'),
            ]),
          ),
      )
      body.query(
        odbQuery()
          .updateTable(authUsers)
          .set({
            tokenVersion: plsqlExpr.add(authUsers.tokenVersion, 1),
            updatedAt: odbOracle.sysTimestamp(),
          })
          .where(cond.eq(authUsers.id, userId)),
      )
      body.query(
        odbQuery()
          .updateTable(authSessions)
          .set({ revokedAt: odbOracle.sysTimestamp() })
          .where(
            cond.and([cond.eq(authSessions.userId, userId), cond.isNull(authSessions.revokedAt)]),
          ),
      )
      body.query(
        odbQuery().deleteFrom(authPasswordResets).where(cond.eq(authPasswordResets.userId, userId)),
      )
      body.call(odbRateLimitApi.success(odbLiteral('AUTH_PASSWORD_CHANGE_USER'), userId))
      body.query(
        odbQuery().deleteFrom(authChallenges).where(cond.eq(authChallenges.userId, userId)),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.unauthorized())
    },
  )

  return { recoverPassword, resetPassword, changePassword }
}
