import { type PackageImpl, odbType } from '../../../../schema/package.js'
import { cond, odbLiteral, PlsqlExpression } from '../../../../schema/attribute.js'
import { odbQuery } from '../../../../query/index.js'
import { odbOracle } from '../../../../oracle/index.js'
import { odbRateLimitApi } from '../../../rate-limit/rate-limit.js'
import { odbAuthCrypto } from '../../core/crypto.js'
import { authTypes } from '../../core/types.js'
import { authUsers } from '../../core/tables/users.js'
import { authIdentities } from '../../core/tables/identities.js'
import { authConfirmations } from './tables.js'
import type { defineAuthPolicy } from '../../core/policy.js'
import type { defineAuthIdentities } from '../../core/identities.js'

export function defineAuthSignup(
  pkg: PackageImpl,
  {
    featureEnabled,
    readPasswordHash,
  }: {
    featureEnabled: ReturnType<typeof defineAuthPolicy>['featureEnabled']
    readPasswordHash: ReturnType<typeof defineAuthIdentities>['readPasswordHash']
  },
) {
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
      body.ifThen(
        cond.or([
          cond.eq(featureEnabled.invoke(odbLiteral('password')), false),
          cond.eq(featureEnabled.invoke(odbLiteral('signup')), false),
        ]),
        (denied) => denied.forbidden('SIGNUP_DISABLED'),
      )
      body.savepoint('odb_password_signup')
      const { email, userId, passwordHash, enabled, pending } = body.variables({
        email: authUsers.username,
        userId: authUsers.id,
        passwordHash: authIdentities.passwordHash,
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
            .select([authUsers.id, authUsers.enabled])
            .into(userId, enabled)
            .where(cond.eq(odbOracle.lower(odbOracle.trim(authUsers.username)), email))
            .forUpdate(),
        )
        inner.set(passwordHash, readPasswordHash.invoke(userId))
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
            cond.isNull(passwordHash),
            cond.eq(odbAuthCrypto.verifyPassword(password, passwordHash), false),
          ]),
          (then) => then.conflict('SIGNUP_EMAIL_EXISTS'),
        )
        inner.when('NO_DATA_FOUND', (handler) => {
          handler.set(userId, odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid())))
          handler.insertInto(authUsers, {
            id: userId,
            username: email,
            displayName: odbOracle.trim(displayName),
            enabled: false,
          })
          handler.insertInto(authIdentities, {
            issuer: 'password',
            subject: email,
            userId,
            passwordHash: odbAuthCrypto.hashPassword(password),
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
      body.when('DUP_VAL_ON_INDEX', (handler) => {
        handler.rollback('odb_password_signup')
        handler.conflict('SIGNUP_EMAIL_EXISTS')
      })
      body.whenOthers((handler) => {
        handler.rollback('odb_password_signup')
        handler.raise()
      })
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

  return { signup, confirmEmail }
}
