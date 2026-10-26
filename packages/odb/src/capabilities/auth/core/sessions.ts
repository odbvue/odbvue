import { type PackageImpl } from '../../../schema/package.js'
import { cond, odbLiteral } from '../../../schema/attribute.js'
import { odbQuery } from '../../../query/index.js'
import { odbOracle } from '../../../oracle/index.js'
import { REFRESH_TOKEN_BYTES, REFRESH_TOKEN_DAYS } from '../constants.js'
import { odbAuthCrypto } from './crypto.js'
import { odbAuthJwt } from './tokens.js'
import { authTypes } from './types.js'
import { authUsers } from './tables/users.js'
import { authSessions } from './tables/sessions.js'

export function defineAuthSessions(pkg: PackageImpl) {
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

  return { openSession, refresh, logout }
}
