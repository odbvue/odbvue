import { odbPackage, odbType } from '../../schema/package.js'
import {
  cond,
  odbLiteral,
  plsqlExpr,
  PlsqlExpression,
  PlsqlStatement,
} from '../../schema/attribute.js'
import { odbQuery } from '../../query/index.js'
import { odbDbmsLob, odbOracle } from '../../oracle/index.js'
import { odbLob } from '../../helpers/lob/lob.js'
import { odbStorage } from '../storage/storage.js'
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
  authPasswordResets,
  authIdentities,
  authFactors,
  authChallenges,
  authRecoveryCodes,
} from './tables.js'
import { authTypes } from './types.js'
import { odbSettings } from '../settings/settings.js'
import { settingsEncryption } from '../settings/encryption.js'
import { authPolicySettings } from './settings.js'

/**
 * PL/SQL API for authentication. Tokens go in and out as plain values: the caller decides how
 * they travel (headers, cookies, bodies) and what a failure looks like on the wire.
 * Refresh tokens never enter access JWTs.
 */
export const odbAuthPackage = odbPackage('odb_auth', (pkg) => {
  const { encrypt, decrypt } = settingsEncryption(pkg)
  const featureEnabled = pkg.func('enabled', odbType.boolean(), (fn) => {
    const { feature } = fn.parameters({ in: { feature: odbType.string(32) } })
    fn.body((body) => {
      const { id, value, meta } = body.variables({
        id: odbType.string(64),
        value: odbSettings.types.value,
        meta: odbSettings.types.meta,
      })
      for (const [name, setting] of authPolicySettings)
        body.ifThen(cond.eq(feature, name), (match) => match.set(id, odbLiteral(setting)))
      body.ifThen(cond.isNull(id), (invalid) => invalid.invalid('AUTH_FEATURE_INVALID'))
      body.call(odbSettings.read(id, value, meta))
      body.ifThen(
        cond.or([cond.isNull(value), cond.and([cond.ne(value, 'Y'), cond.ne(value, 'N')])]),
        (invalid) => invalid.invalid('AUTH_CONFIG_INVALID'),
      )
      body.return(cond.eq(value, 'Y'))
    })
  })
  const dummyPasswordHashConstant = pkg.privateConstant(
    'c_dummy_password_hash',
    odbType.string(512),
    'dummyPasswordHash',
  )

  const readPasswordHash = pkg.privateFunc('read_password_hash', odbType.string(512), (fn) => {
    const { userId } = fn.parameters({ in: { userId: authUsers.id } })
    fn.body((body) => {
      const { passwordHash } = body.variables({ passwordHash: authIdentities.passwordHash })
      body.query(
        odbQuery()
          .selectFrom(authIdentities)
          .select(authIdentities.passwordHash)
          .into(passwordHash)
          .where(
            cond.and([
              cond.eq(authIdentities.userId, userId),
              cond.eq(authIdentities.issuer, 'password'),
            ]),
          ),
      )
      body.return(passwordHash)
      body.when('NO_DATA_FOUND', (handler) => handler.return(null))
    })
  })

  const openSession = pkg.privateProc('open_session', (proc) => {
    const { userId, accessToken, refreshToken } = proc.parameters({
      in: { userId: authTypes.userId },
      out: { accessToken: authTypes.accessToken, refreshToken: authTypes.refreshToken },
    })
    proc.body((body) => {
      const { tokenVersion, sessionId, newRefreshToken } = body.variables({
        tokenVersion: authUsers.tokenVersion,
        sessionId: authSessions.id,
        newRefreshToken: authTypes.refreshToken,
      })
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.tokenVersion)
          .into(tokenVersion)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)]))
          .forUpdate(),
      )
      body.set(sessionId, odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid())))
      body.set(newRefreshToken, odbAuthCrypto.randomToken(odbLiteral(REFRESH_TOKEN_BYTES)))
      body.insertInto(authSessions, {
        id: sessionId,
        userId,
        refreshTokenHash: odbAuthCrypto.hashToken(newRefreshToken),
        expiresAt: odbOracle.plus(
          odbOracle.sysTimestamp(),
          odbOracle.interval.days(REFRESH_TOKEN_DAYS),
        ),
      })
      body.set(accessToken, odbAuthJwt.createAccessToken(userId, sessionId, tokenVersion))
      body.set(refreshToken, newRefreshToken)
      body.when('NO_DATA_FOUND', (handler) => handler.unauthorized())
    })
  })

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

  const verifyCredentials = pkg.privateProc('verify_credentials', (proc) => {
    const { username, password, userId } = proc.parameters({
      in: { username: authUsers.username, password: authTypes.password },
      out: { userId: authUsers.id },
    })
    proc.body((statements) => {
      statements.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('password')), false), (denied) =>
        denied.forbidden('PASSWORD_DISABLED'),
      )
      const { passwordHash, loginSubject } = statements.variables({
        passwordHash: authIdentities.passwordHash,
        loginSubject: odbType.string(128),
      })
      statements.set(loginSubject, odbOracle.lower(odbOracle.trim(username)))
      statements.call(odbRateLimitApi.enforce(odbLiteral('AUTH_LOGIN_USERNAME'), loginSubject))
      statements.block((inner) => {
        inner.query(
          odbQuery()
            .selectFrom(authUsers)
            .select(authUsers.id)
            .into(userId)
            .where(
              cond.and([
                cond.eq(odbOracle.lower(odbOracle.trim(authUsers.username)), loginSubject),
                cond.eq(authUsers.enabled, true),
              ]),
            )
            .forUpdate(),
        )
        inner.set(passwordHash, readPasswordHash.invoke(userId))
        inner.ifThen(cond.isNull(passwordHash), (then) => then.set(userId, null))
        inner.when('NO_DATA_FOUND', (handler) =>
          handler.set(passwordHash, dummyPasswordHashConstant),
        )
      })
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
      statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized('INVALID_CREDENTIALS'))
    })
  })

  const login = pkg.proc(
    'login',
    {
      in: { username: authUsers.username, password: authTypes.password },
      out: { accessToken: authTypes.accessToken, refreshToken: authTypes.refreshToken },
    },
    ({ params: { username, password, accessToken, refreshToken }, body }) => {
      const { userId } = body.variables({ userId: authUsers.id })
      body.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('twoFactor')), true), (denied) =>
        denied.forbidden('TWO_FACTOR_REQUIRED'),
      )
      body.call(verifyCredentials.invoke(username, password, userId))
      body.call(openSession.invoke(userId, accessToken, refreshToken))
    },
  )

  const beginLogin = pkg.proc(
    'begin_login',
    {
      in: { username: authUsers.username, password: authTypes.password },
      out: {
        accessToken: authTypes.accessToken,
        refreshToken: authTypes.refreshToken,
        challenge: odbType.string(64),
        setupSecret: odbType.string(32),
      },
    },
    ({
      params: { username, password, accessToken, refreshToken, challenge, setupSecret },
      body,
    }) => {
      body.savepoint('odb_auth_begin_login')
      const { userId, tokenVersion, count, secret, encrypted } = body.variables({
        userId: authUsers.id,
        tokenVersion: authUsers.tokenVersion,
        count: odbType.integer(),
        secret: odbType.string(40),
        encrypted: odbType.clob(),
      })
      body.set(accessToken, null)
      body.set(refreshToken, null)
      body.set(challenge, null)
      body.set(setupSecret, null)
      body.call(verifyCredentials.invoke(username, password, userId))
      body.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('twoFactor')), false), (plain) => {
        plain.call(openSession.invoke(userId, accessToken, refreshToken))
        plain.return()
      })
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_2FA_START_USER'), userId))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_2FA_START_USER'), userId))
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.tokenVersion)
          .into(tokenVersion)
          .where(cond.eq(authUsers.id, userId)),
      )
      body.query(
        odbQuery()
          .selectFrom(authFactors)
          .select('COUNT(*)')
          .into(count)
          .where(cond.eq(authFactors.userId, userId)),
      )
      body.ifThen(cond.eq(count, 0), (enroll) => {
        enroll.set(secret, odbAuthCrypto.randomToken(odbLiteral(20)))
        enroll.set(setupSecret, odbAuthCrypto.base32Secret(secret))
        enroll.set(
          encrypted,
          encrypt.invoke(plsqlExpr.concat(odbLiteral('odb-auth-totp:'), userId), secret),
        )
      })
      body.set(challenge, odbAuthCrypto.randomToken(odbLiteral(32)))
      body.query(
        odbQuery().deleteFrom(authChallenges).where(cond.eq(authChallenges.userId, userId)),
      )
      body.insertInto(authChallenges, {
        userId,
        tokenVersion,
        tokenHash: odbAuthCrypto.hashToken(challenge),
        secret: encrypted,
        expiresAt: odbOracle.plus(odbOracle.sysTimestamp(), odbOracle.interval.seconds(300)),
      })
      body.whenOthers((handler) => {
        handler.rollback('odb_auth_begin_login')
        handler.raise()
      })
    },
  )

  const verifyTwoFactor = pkg.proc(
    'verify_two_factor',
    {
      in: { challenge: odbType.string(64), code: odbType.string(128) },
      out: {
        accessToken: authTypes.accessToken,
        refreshToken: authTypes.refreshToken,
        recoveryCodes: odbType.json(),
        nextChallenge: odbType.string(64),
        setupSecret: odbType.string(32),
      },
    },
    ({
      params: {
        challenge,
        code,
        accessToken,
        refreshToken,
        recoveryCodes,
        nextChallenge,
        setupSecret,
      },
      body,
    }) => {
      body.savepoint('odb_auth_verify_factor')
      const {
        userId,
        tokenVersion,
        challengeVersion,
        pendingSecret,
        storedSecret,
        lastCounter,
        counter,
        count,
        recoveryCode,
        codes,
        newSecret,
      } = body.variables({
        userId: authUsers.id,
        tokenVersion: authUsers.tokenVersion,
        challengeVersion: authUsers.tokenVersion,
        pendingSecret: odbType.clob(),
        storedSecret: odbType.clob(),
        lastCounter: odbType.number(),
        counter: odbType.number(),
        count: odbType.integer(),
        recoveryCode: odbType.string(32),
        codes: { type: 'json_array_t' },
        newSecret: odbType.string(40),
      })
      body.set(accessToken, null)
      body.set(refreshToken, null)
      body.set(nextChallenge, null)
      body.set(setupSecret, null)
      body.ifThen(
        cond.or([
          cond.eq(featureEnabled.invoke(odbLiteral('password')), false),
          cond.eq(featureEnabled.invoke(odbLiteral('twoFactor')), false),
        ]),
        (denied) => denied.forbidden('TWO_FACTOR_DISABLED'),
      )
      body.ifThen(
        cond.or([
          cond.isNull(challenge),
          cond.not(cond.regexpLike(challenge, '^[A-F0-9]{64}$')),
          cond.isNull(code),
          cond.gt(odbOracle.length(code), 32),
        ]),
        (invalid) => invalid.unauthorized('TWO_FACTOR_INVALID'),
      )
      const validChallenge = () =>
        cond.and([
          cond.eq(authChallenges.tokenHash, odbAuthCrypto.hashToken(challenge)),
          cond.gt(authChallenges.expiresAt, odbOracle.sysTimestamp()),
        ])
      body.query(
        odbQuery()
          .selectFrom(authChallenges)
          .select(authChallenges.userId)
          .into(userId)
          .where(validChallenge()),
      )
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_2FA_USER'), userId))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_2FA_USER'), userId))
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.tokenVersion)
          .into(tokenVersion)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)]))
          .forUpdate(),
      )
      body.query(
        odbQuery()
          .selectFrom(authChallenges)
          .select([authChallenges.tokenVersion, authChallenges.secret])
          .into(challengeVersion, pendingSecret)
          .where(validChallenge())
          .forUpdate(),
      )
      body.ifThen(cond.ne(tokenVersion, challengeVersion), (invalid) =>
        invalid.unauthorized('TWO_FACTOR_INVALID'),
      )
      body.set(recoveryCodes, '[]')
      body.ifThen(
        cond.isNotNull(pendingSecret),
        (enroll) => {
          enroll.set(
            counter,
            odbAuthCrypto.verifyTotp(
              decrypt.invoke(plsqlExpr.concat(odbLiteral('odb-auth-totp:'), userId), pendingSecret),
              code,
              odbLiteral(-1),
            ),
          )
          enroll.ifThen(cond.lt(counter, 0), (invalid) =>
            invalid.unauthorized('TWO_FACTOR_INVALID'),
          )
          enroll.query(
            odbQuery().deleteFrom(authFactors).where(cond.eq(authFactors.userId, userId)),
          )
          enroll.query(
            odbQuery()
              .deleteFrom(authRecoveryCodes)
              .where(cond.eq(authRecoveryCodes.userId, userId)),
          )
          enroll.insertInto(authFactors, { userId, secret: pendingSecret, lastCounter: counter })
          enroll.query(
            odbQuery()
              .updateTable(authUsers)
              .set({
                tokenVersion: plsqlExpr.add(authUsers.tokenVersion, 1),
                updatedAt: odbOracle.sysTimestamp(),
              })
              .where(cond.eq(authUsers.id, userId)),
          )
          enroll.query(
            odbQuery()
              .updateTable(authSessions)
              .set({ revokedAt: odbOracle.sysTimestamp() })
              .where(
                cond.and([
                  cond.eq(authSessions.userId, userId),
                  cond.isNull(authSessions.revokedAt),
                ]),
              ),
          )
          enroll.set(codes, new PlsqlExpression('json_array_t', 'json_array_t()'))
          enroll.forRange('recovery', 1, 10, (_index, loop) => {
            loop.set(recoveryCode, odbAuthCrypto.randomToken(odbLiteral(16)))
            loop.insertInto(authRecoveryCodes, {
              userId,
              codeHash: odbAuthCrypto.hashToken(recoveryCode),
            })
            loop.call(new PlsqlStatement(`${codes.toSQL()}.append(${recoveryCode.toSQL()})`))
          })
          enroll.set(recoveryCodes, new PlsqlExpression('CLOB', `${codes.toSQL()}.to_clob()`))
        },
        (verify) => {
          verify.query(
            odbQuery()
              .selectFrom(authFactors)
              .select([authFactors.secret, authFactors.lastCounter])
              .into(storedSecret, lastCounter)
              .where(cond.eq(authFactors.userId, userId))
              .forUpdate(),
          )
          verify.ifThen(
            cond.regexpLike(code, '^[A-Fa-f0-9]{32}$'),
            (recovery) => {
              recovery.query(
                odbQuery()
                  .selectFrom(authRecoveryCodes)
                  .select('COUNT(*)')
                  .into(count)
                  .where(
                    cond.and([
                      cond.eq(authRecoveryCodes.userId, userId),
                      cond.eq(
                        authRecoveryCodes.codeHash,
                        odbAuthCrypto.hashToken(odbOracle.upper(code)),
                      ),
                    ]),
                  ),
              )
              recovery.ifThen(cond.ne(count, 1), (invalid) =>
                invalid.unauthorized('TWO_FACTOR_INVALID'),
              )
              recovery.query(
                odbQuery()
                  .deleteFrom(authRecoveryCodes)
                  .where(
                    cond.and([
                      cond.eq(authRecoveryCodes.userId, userId),
                      cond.eq(
                        authRecoveryCodes.codeHash,
                        odbAuthCrypto.hashToken(odbOracle.upper(code)),
                      ),
                    ]),
                  ),
              )
              recovery.set(newSecret, odbAuthCrypto.randomToken(odbLiteral(20)))
              recovery.set(setupSecret, odbAuthCrypto.base32Secret(newSecret))
              recovery.set(nextChallenge, odbAuthCrypto.randomToken(odbLiteral(32)))
              recovery.set(
                pendingSecret,
                encrypt.invoke(plsqlExpr.concat(odbLiteral('odb-auth-totp:'), userId), newSecret),
              )
              recovery.query(
                odbQuery()
                  .updateTable(authChallenges)
                  .set({
                    tokenHash: odbAuthCrypto.hashToken(nextChallenge),
                    secret: pendingSecret,
                    expiresAt: odbOracle.plus(
                      odbOracle.sysTimestamp(),
                      odbOracle.interval.seconds(300),
                    ),
                  })
                  .where(cond.eq(authChallenges.userId, userId)),
              )
              recovery.return()
            },
            (totp) => {
              totp.set(
                counter,
                odbAuthCrypto.verifyTotp(
                  decrypt.invoke(
                    plsqlExpr.concat(odbLiteral('odb-auth-totp:'), userId),
                    storedSecret,
                  ),
                  code,
                  lastCounter,
                ),
              )
              totp.ifThen(cond.lt(counter, 0), (invalid) =>
                invalid.unauthorized('TWO_FACTOR_INVALID'),
              )
              totp.query(
                odbQuery()
                  .updateTable(authFactors)
                  .set({ lastCounter: counter })
                  .where(cond.eq(authFactors.userId, userId)),
              )
            },
          )
        },
      )
      body.query(
        odbQuery().deleteFrom(authChallenges).where(cond.eq(authChallenges.userId, userId)),
      )
      body.call(openSession.invoke(userId, accessToken, refreshToken))
      body.call(odbRateLimitApi.success(odbLiteral('AUTH_2FA_USER'), userId))
      body.call(odbRateLimitApi.success(odbLiteral('AUTH_2FA_START_USER'), userId))
      body.when('NO_DATA_FOUND', (invalid) => {
        invalid.rollback('odb_auth_verify_factor')
        invalid.unauthorized('TWO_FACTOR_INVALID')
      })
      body.whenOthers((handler) => {
        handler.rollback('odb_auth_verify_factor')
        handler.raise()
      })
    },
  )

  const loginGoogle = pkg.proc(
    'login_google',
    {
      in: {
        subject: odbType.string(255),
        email: authTypes.username,
        displayName: authTypes.displayName,
      },
      out: { accessToken: authTypes.accessToken, refreshToken: authTypes.refreshToken },
    },
    ({ params: { subject, email, displayName, accessToken, refreshToken }, body }) => {
      body.savepoint('odb_google_login')
      body.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('google')), false), (denied) =>
        denied.forbidden('GOOGLE_DISABLED'),
      )
      const { userId, address, existing } = body.variables({
        userId: authUsers.id,
        address: authUsers.username,
        existing: odbType.integer(),
      })
      const issuer = odbLiteral('https://accounts.google.com')
      body.ifThen(
        cond.or([
          cond.isNull(subject),
          cond.not(cond.regexpLike(subject, '^[0-9]{1,255}$')),
          cond.isNull(email),
          cond.gt(odbOracle.length(email), 128),
          cond.not(cond.regexpLike(email, '^[^[:space:]@]+@[^[:space:]@.]+([.][^[:space:]@.]+)+$')),
        ]),
        (then) => then.unauthorized('GOOGLE_IDENTITY_INVALID'),
      )
      body.set(address, odbOracle.lower(odbOracle.trim(email)))
      body.block((inner) => {
        inner.query(
          odbQuery()
            .selectFrom(authIdentities)
            .select(authIdentities.userId)
            .into(userId)
            .where(
              cond.and([
                cond.eq(authIdentities.issuer, issuer),
                cond.eq(authIdentities.subject, subject),
              ]),
            ),
        )
        inner.when('NO_DATA_FOUND', (handler) => {
          handler.query(
            odbQuery()
              .selectFrom(authUsers)
              .select('COUNT(*)')
              .into(existing)
              .where(cond.eq(odbOracle.lower(odbOracle.trim(authUsers.username)), address)),
          )
          handler.ifThen(cond.gt(existing, 0), (then) => then.conflict('GOOGLE_EMAIL_EXISTS'))
          handler.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('signup')), false), (denied) =>
            denied.forbidden('SIGNUP_DISABLED'),
          )
          handler.set(userId, odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid())))
          handler.insertInto(authUsers, {
            id: userId,
            username: address,
            displayName: odbOracle.substr(
              odbOracle.nvl(odbOracle.trim(displayName), address),
              1,
              256,
            ),
            enabled: true,
          })
          handler.insertInto(authIdentities, { issuer, subject, userId })
        })
      })
      body.call(openSession.invoke(userId, accessToken, refreshToken))
      body.when('DUP_VAL_ON_INDEX', (handler) => {
        handler.rollback('odb_google_login')
        handler.conflict('GOOGLE_EMAIL_EXISTS')
      })
      body.whenOthers((handler) => {
        handler.rollback('odb_google_login')
        handler.raise()
      })
    },
  )

  const linkSession = pkg.privateProc('link_session', (proc) => {
    const { userId, refreshToken, sessionId, tokenVersion, passwordHash } = proc.parameters({
      in: { userId: authUsers.id, refreshToken: authTypes.refreshToken },
      out: {
        sessionId: authSessions.id,
        tokenVersion: authUsers.tokenVersion,
        passwordHash: authIdentities.passwordHash,
      },
    })
    proc.body((body) => {
      body.ifThen(
        cond.or([
          cond.isNull(refreshToken),
          cond.not(cond.regexpLike(refreshToken, '^[[:xdigit:]]{128}$')),
        ]),
        (then) => then.unauthorized('GOOGLE_LINK_SESSION_INVALID'),
      )
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.tokenVersion)
          .into(tokenVersion)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)]))
          .forUpdate(),
      )
      body.set(passwordHash, readPasswordHash.invoke(userId))
      body.query(
        odbQuery()
          .selectFrom(authSessions)
          .select(authSessions.id)
          .into(sessionId)
          .where(
            cond.and([
              cond.eq(authSessions.userId, userId),
              cond.eq(authSessions.refreshTokenHash, odbAuthCrypto.hashToken(refreshToken)),
              cond.isNull(authSessions.revokedAt),
              cond.gt(authSessions.expiresAt, odbOracle.sysTimestamp()),
            ]),
          )
          .forUpdate(),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.unauthorized('GOOGLE_LINK_SESSION_INVALID'))
    })
  })

  const prepareGoogleLink = pkg.proc(
    'prepare_google_link',
    {
      in: {
        userId: authUsers.id,
        refreshToken: authTypes.refreshToken,
        password: authTypes.password,
      },
      out: { sessionId: authSessions.id, tokenVersion: authUsers.tokenVersion },
    },
    ({ params: { userId, refreshToken, password, sessionId, tokenVersion }, body }) => {
      const { passwordHash } = body.variables({ passwordHash: authIdentities.passwordHash })
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_GOOGLE_LINK_USER'), userId))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_GOOGLE_LINK_USER'), userId))
      body.call(linkSession.invoke(userId, refreshToken, sessionId, tokenVersion, passwordHash))
      body.ifThen(
        cond.or([
          cond.isNull(passwordHash),
          cond.isNull(password),
          cond.gt(odbOracle.length(password), 256),
          cond.eq(odbAuthCrypto.verifyPassword(password, passwordHash), false),
        ]),
        (invalid) => invalid.unauthorized('GOOGLE_LINK_PASSWORD_INVALID'),
      )
    },
  )

  const checkGoogleLink = pkg.proc(
    'check_google_link',
    {
      in: {
        userId: authUsers.id,
        sessionId: authSessions.id,
        tokenVersion: authUsers.tokenVersion,
        refreshToken: authTypes.refreshToken,
      },
    },
    ({ params: { userId, sessionId, tokenVersion, refreshToken }, body }) => {
      const current = body.variables({
        currentSession: authSessions.id,
        currentVersion: authUsers.tokenVersion,
        passwordHash: authIdentities.passwordHash,
      })
      body.call(
        linkSession.invoke(
          userId,
          refreshToken,
          current.currentSession,
          current.currentVersion,
          current.passwordHash,
        ),
      )
      body.ifThen(
        cond.or([
          cond.isNull(sessionId),
          cond.isNull(tokenVersion),
          cond.ne(sessionId, current.currentSession),
          cond.ne(tokenVersion, current.currentVersion),
        ]),
        (then) => then.unauthorized('GOOGLE_LINK_SESSION_CHANGED'),
      )
    },
  )

  /** Trusted verified-subject entry point; no profile, credential or session changes. */
  const linkGoogle = pkg.proc(
    'link_google',
    {
      in: {
        userId: authUsers.id,
        sessionId: authSessions.id,
        tokenVersion: authUsers.tokenVersion,
        refreshToken: authTypes.refreshToken,
        subject: authIdentities.subject,
      },
    },
    ({ params: { userId, sessionId, tokenVersion, refreshToken, subject }, body }) => {
      const { owner } = body.variables({ owner: authUsers.id })
      const issuer = odbLiteral('https://accounts.google.com')
      body.ifThen(
        cond.or([cond.isNull(subject), cond.not(cond.regexpLike(subject, '^[0-9]{1,255}$'))]),
        (then) => then.unauthorized('GOOGLE_IDENTITY_INVALID'),
      )
      body.call(checkGoogleLink.invoke(userId, sessionId, tokenVersion, refreshToken))
      body.block((insert) => {
        insert.insertInto(authIdentities, { issuer, subject, userId })
        // A concurrent insertion may win; read its committed owner instead of merging.
        insert.when('DUP_VAL_ON_INDEX', (handler) => {
          handler.query(
            odbQuery()
              .selectFrom(authIdentities)
              .select(authIdentities.userId)
              .into(owner)
              .where(
                cond.and([
                  cond.eq(authIdentities.issuer, issuer),
                  cond.eq(authIdentities.subject, subject),
                ]),
              ),
          )
          handler.ifThen(cond.ne(owner, userId), (then) => then.conflict('GOOGLE_IDENTITY_EXISTS'))
        })
      })
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

  const updateGoogleAvatar = pkg.proc(
    'update_google_avatar',
    { in: { subject: authIdentities.subject, picture: odbType.string(2048) } },
    ({ params: { subject, picture }, body }) => {
      const { userId } = body.variables({ userId: authUsers.id })
      body.ifThen(cond.isNull(picture), (then) => then.return())
      body.ifThen(
        cond.not(
          cond.regexpLike(
            picture,
            '^https://lh[0-9]+[.]googleusercontent[.]com/[^[:space:][:cntrl:]]+$',
            'c',
          ),
        ),
        (then) => then.invalid('PROFILE_GOOGLE_AVATAR_INVALID'),
      )
      body.query(
        odbQuery()
          .selectFrom(authIdentities)
          .select(authIdentities.userId)
          .into(userId)
          .where(
            cond.and([
              cond.eq(authIdentities.subject, subject),
              cond.eq(authIdentities.issuer, 'https://accounts.google.com'),
            ]),
          ),
      )
      body.query(
        odbQuery()
          .updateTable(authUsers)
          .set({ googleAvatarUrl: picture })
          .where(cond.eq(authUsers.id, userId)),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.notFound())
    },
  )

  const readProfile = pkg.proc(
    'read_profile',
    {
      in: { userId: authUsers.id },
      out: {
        avatarUrl: odbType.clob(),
        avatarUploaded: odbType.integer(),
        passwordConnected: odbType.integer(),
        googleConnected: odbType.integer(),
        avatarId: authUsers.avatar,
      },
    },
    ({
      params: { userId, avatarUrl, avatarUploaded, passwordConnected, googleConnected, avatarId },
      body,
    }) => {
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select([
            authUsers.googleAvatarUrl,
            odbOracle.caseWhen(
              cond.isNull(authUsers.avatar),
              odbLiteral(0),
              odbLiteral(1),
              'NUMBER',
            ),
            authUsers.avatar,
          ])
          .into(avatarUrl, avatarUploaded, avatarId)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)])),
      )
      body.query(
        odbQuery()
          .selectFrom(authIdentities)
          .select([
            odbOracle.count(
              odbOracle.caseWhen(
                cond.eq(authIdentities.issuer, 'password'),
                odbLiteral(1),
                odbOracle.null(),
                'NUMBER',
              ),
            ),
            odbOracle.count(
              odbOracle.caseWhen(
                cond.eq(authIdentities.issuer, 'https://accounts.google.com'),
                odbLiteral(1),
                odbOracle.null(),
                'NUMBER',
              ),
            ),
          ])
          .into(passwordConnected, googleConnected)
          .where(cond.eq(authIdentities.userId, userId)),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.notFound())
    },
  )

  const updateAvatar = pkg.proc(
    'update_avatar',
    { in: { userId: authUsers.id, avatar: odbType.clob() } },
    ({ params: { userId, avatar }, body }) => {
      const { previousAvatar, avatarId, content } = body.variables({
        previousAvatar: authUsers.avatar,
        avatarId: authUsers.avatar,
        content: odbType.blob(),
      })
      body.ifThen(cond.isNotNull(avatar), (validate) => {
        validate.ifThen(
          cond.or([
            cond.gt(odbDbmsLob.getLength(avatar), 30000),
            cond.lt(odbDbmsLob.getLength(avatar), 31),
            cond.not(
              cond.regexpLike(
                avatar,
                '^data:image/jpeg;base64,/9j/([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',
                'c',
              ),
            ),
          ]),
          (then) => then.invalid('PROFILE_AVATAR_INVALID'),
        )
        validate.set(content, odbLob.base64ToBlob(odbDbmsLob.substr(avatar, 30000, 24)))
        validate.ifThen(
          cond.ne(odbOracle.rawToHex(odbDbmsLob.substrRaw(content, 3, 1)), 'FFD8FF'),
          (then) => then.invalid('PROFILE_AVATAR_INVALID'),
        )
      })
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.avatar)
          .into(previousAvatar)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)]))
          .forUpdate(),
      )
      body.ifThen(cond.isNotNull(content), (then) => {
        then.call(
          odbStorage.write(
            userId,
            odbLiteral('avatar.jpg'),
            odbLiteral('image/jpeg'),
            content,
            odbLiteral('{"purpose":"avatar"}'),
            avatarId,
          ),
        )
      })
      body.query(
        odbQuery()
          .updateTable(authUsers)
          .set({ avatar: avatarId, updatedAt: odbOracle.sysTimestamp() })
          .where(cond.eq(authUsers.id, userId)),
      )
      body.ifThen(cond.isNotNull(previousAvatar), (then) =>
        then.call(odbStorage.remove(userId, previousAvatar)),
      )
      body.ifThen(cond.eq(odbDbmsLob.isTemporary(content), 1), (then) =>
        then.call(odbDbmsLob.freeTemporary(content)),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.notFound())
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
      body.set(permissions, new PlsqlExpression('CLOB', `${permissionArray.toSQL()}.to_clob()`))
    },
  )

  return {
    enabled: featureEnabled,
    beginLogin,
    verifyTwoFactor,
    signup,
    confirmEmail,
    recoverPassword,
    resetPassword,
    login,
    loginGoogle,
    prepareGoogleLink,
    checkGoogleLink,
    linkGoogle,
    refresh,
    logout,
    requireUser,
    readUser,
    readProfile,
    updateGoogleAvatar,
    updateAvatar,
    changePassword,
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
