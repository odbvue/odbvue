import { type PackageImpl, odbType } from '../../schema/package.js'
import { cond, odbLiteral } from '../../schema/attribute.js'
import { odbQuery } from '../../query/index.js'
import { odbOracle } from '../../oracle/index.js'
import { odbRateLimitApi } from '../rate-limit/rate-limit.js'
import { odbAuthCrypto } from './core/crypto.js'
import { authTypes } from './core/types.js'
import { authUsers } from './core/tables/users.js'
import { authIdentities } from './core/tables/identities.js'
import type { defineAuthPolicy } from './core/policy.js'
import type { defineAuthIdentities } from './core/identities.js'
import type { defineAuthSessions } from './core/sessions.js'
import type { defineLdapCredentials } from './features/ldap/credentials.js'

export function defineAuthLogin(
  pkg: PackageImpl,
  {
    featureEnabled,
    readPasswordHash,
    openSession,
    verifyLdapCredentials,
  }: {
    featureEnabled: ReturnType<typeof defineAuthPolicy>['featureEnabled']
    readPasswordHash: ReturnType<typeof defineAuthIdentities>['readPasswordHash']
    openSession: ReturnType<typeof defineAuthSessions>['openSession']
    verifyLdapCredentials: ReturnType<typeof defineLdapCredentials>
  },
) {
  const dummyPasswordHashConstant = pkg.privateConstant(
    'c_dummy_password_hash',
    odbType.string(512),
    'dummyPasswordHash',
  )

  const verifyCredentials = pkg.privateProc('verify_credentials', (proc) => {
    const { username, password, userId } = proc.parameters({
      in: { username: authUsers.username, password: authTypes.password },
      out: { userId: authUsers.id },
    })
    proc.body((statements) => {
      const { passwordHash, loginSubject, ldapSubject, existing, enabled } = statements.variables({
        passwordHash: authIdentities.passwordHash,
        loginSubject: odbType.string(128),
        ldapSubject: odbType.string(255),
        existing: odbType.integer(),
        enabled: authUsers.enabled,
      })
      statements.set(userId, null)
      statements.set(loginSubject, odbOracle.lower(odbOracle.trim(username)))
      statements.ifThen(
        cond.or([
          cond.isNull(loginSubject),
          cond.gt(odbOracle.length(username), 128),
          cond.isNull(password),
          cond.gt(odbOracle.length(password), 512),
        ]),
        (invalid) => invalid.unauthorized('INVALID_CREDENTIALS'),
      )
      statements.call(odbRateLimitApi.enforce(odbLiteral('AUTH_LOGIN_USERNAME'), loginSubject))
      statements.call(odbRateLimitApi.failure(odbLiteral('AUTH_LOGIN_USERNAME'), loginSubject))
      statements.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('ldap')), true), (ldap) => {
        ldap.call(verifyLdapCredentials.invoke(loginSubject, password, ldapSubject))
        ldap.ifThen(cond.isNotNull(ldapSubject), (found) => {
          found.block((identity) => {
            identity.query(
              odbQuery()
                .selectFrom(authIdentities)
                .select(authIdentities.userId)
                .into(userId)
                .where(
                  cond.and([
                    cond.eq(authIdentities.issuer, 'ldap'),
                    cond.eq(authIdentities.subject, ldapSubject),
                  ]),
                ),
            )
            identity.when('NO_DATA_FOUND', (create) => {
              create.query(
                odbQuery()
                  .selectFrom(authUsers)
                  .select('COUNT(*)')
                  .into(existing)
                  .where(
                    cond.eq(odbOracle.lower(odbOracle.trim(authUsers.username)), loginSubject),
                  ),
              )
              create.ifThen(cond.gt(existing, 0), (collision) =>
                collision.conflict('LDAP_USERNAME_EXISTS'),
              )
              create.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('signup')), false), (denied) =>
                denied.forbidden('SIGNUP_DISABLED'),
              )
              create.set(userId, odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid())))
              create.insertInto(authUsers, {
                id: userId,
                username: loginSubject,
                displayName: loginSubject,
                enabled: true,
              })
              create.insertInto(authIdentities, {
                issuer: 'ldap',
                subject: ldapSubject,
                userId,
              })
            })
          })
          found.query(
            odbQuery()
              .selectFrom(authUsers)
              .select(authUsers.enabled)
              .into(enabled)
              .where(cond.eq(authUsers.id, userId))
              .forUpdate(),
          )
          found.ifThen(cond.ne(enabled, 1), (denied) => denied.unauthorized('INVALID_CREDENTIALS'))
          found.call(odbRateLimitApi.success(odbLiteral('AUTH_LOGIN_USERNAME'), loginSubject))
          found.return()
        })
      })
      statements.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('password')), false), (denied) =>
        denied.forbidden('PASSWORD_DISABLED'),
      )
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
          then.unauthorized('INVALID_CREDENTIALS')
        },
      )
      statements.call(odbRateLimitApi.success(odbLiteral('AUTH_LOGIN_USERNAME'), loginSubject))
      statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized('INVALID_CREDENTIALS'))
      statements.when('DUP_VAL_ON_INDEX', (handler) => handler.conflict('LDAP_USERNAME_EXISTS'))
    })
  })

  const login = pkg.proc(
    'login',
    {
      in: { username: authUsers.username, password: authTypes.password },
      out: { accessToken: authTypes.accessToken, refreshToken: authTypes.refreshToken },
    },
    ({ params: { username, password, accessToken, refreshToken }, body }) => {
      body.savepoint('odb_auth_login')
      const { userId } = body.variables({ userId: authUsers.id })
      body.ifThen(cond.eq(featureEnabled.invoke(odbLiteral('twoFactor')), true), (denied) =>
        denied.forbidden('TWO_FACTOR_REQUIRED'),
      )
      body.call(verifyCredentials.invoke(username, password, userId))
      body.call(openSession.invoke(userId, accessToken, refreshToken))
      body.whenOthers((handler) => {
        handler.rollback('odb_auth_login')
        handler.raise()
      })
    },
  )

  return { verifyCredentials, login }
}
