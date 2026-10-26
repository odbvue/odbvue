import { type PackageImpl, odbType } from '../../../../schema/package.js'
import { cond, odbLiteral } from '../../../../schema/attribute.js'
import { odbQuery } from '../../../../query/index.js'
import { odbOracle } from '../../../../oracle/index.js'
import { odbRateLimitApi } from '../../../rate-limit/rate-limit.js'
import { odbAuthCrypto } from '../../core/crypto.js'
import { authTypes } from '../../core/types.js'
import { authUsers } from '../../core/tables/users.js'
import { authIdentities } from '../../core/tables/identities.js'
import { authSessions } from '../../core/tables/sessions.js'
import type { defineAuthPolicy } from '../../core/policy.js'
import type { defineAuthIdentities } from '../../core/identities.js'
import type { defineAuthSessions } from '../../core/sessions.js'

export function defineAuthGoogle(
  pkg: PackageImpl,
  {
    featureEnabled,
    readPasswordHash,
    openSession,
  }: {
    featureEnabled: ReturnType<typeof defineAuthPolicy>['featureEnabled']
    readPasswordHash: ReturnType<typeof defineAuthIdentities>['readPasswordHash']
    openSession: ReturnType<typeof defineAuthSessions>['openSession']
  },
) {
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

  return { loginGoogle, prepareGoogleLink, checkGoogleLink, linkGoogle, updateGoogleAvatar }
}
