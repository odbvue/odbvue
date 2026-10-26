import { type PackageImpl, odbType } from '../../../../schema/package.js'
import {
  cond,
  odbLiteral,
  plsqlExpr,
  PlsqlExpression,
  PlsqlStatement,
} from '../../../../schema/attribute.js'
import { odbQuery } from '../../../../query/index.js'
import { odbOracle } from '../../../../oracle/index.js'
import { odbRateLimitApi } from '../../../rate-limit/rate-limit.js'
import { odbAuthCrypto } from '../../core/crypto.js'
import { authTypes } from '../../core/types.js'
import { settingsEncryption } from '../../../settings/encryption.js'
import { authUsers } from '../../core/tables/users.js'
import { authSessions } from '../../core/tables/sessions.js'
import { authFactors, authChallenges, authRecoveryCodes } from './tables.js'
import type { defineAuthPolicy } from '../../core/policy.js'
import type { defineAuthSessions } from '../../core/sessions.js'
import type { defineAuthLogin } from '../../login.js'

export function defineAuthTwoFactor(
  pkg: PackageImpl,
  {
    featureEnabled,
    openSession,
    verifyCredentials,
  }: {
    featureEnabled: ReturnType<typeof defineAuthPolicy>['featureEnabled']
    openSession: ReturnType<typeof defineAuthSessions>['openSession']
    verifyCredentials: ReturnType<typeof defineAuthLogin>['verifyCredentials']
  },
) {
  const { encrypt, decrypt } = settingsEncryption(pkg)
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

  return { beginLogin, verifyTwoFactor }
}
