import { pbkdf2Sync } from 'node:crypto'
import { defineService, odbPackage, odbType } from '../../../schema/package.js'
import { cond, odbLiteral, plsqlExpr, type PlsqlValue } from '../../../schema/attribute.js'
import { plsqlBlock, qualify } from '../../../schema/ddl.js'
import { odbTable } from '../../../schema/table.js'
import { odbQuery } from '../../../query/index.js'
import { odbDbmsCrypto, odbOracle, odbUtlI18n, odbUtlRaw } from '../../oracle/index.js'
import { odbHttp } from '../http/http.js'
import { odbJwt } from '../jwt/jwt.js'
import { odbRateLimit, odbRateLimitApi } from '../rate-limit/rate-limit.js'

const DEFAULT_JWT_SECRET = 'change-this-development-only-odbvue-auth-secret-2026'
const PASSWORD_HASH_ALGORITHM = 'pbkdf2-sha512'
const PASSWORD_HASH_ITERATIONS = 210000
const PASSWORD_HASH_BYTES = 64
const REFRESH_TOKEN_BYTES = 64
const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const authCookieOptions = {
  refreshCookieName: '__Host-odb_refresh',
  refreshCookieSecure: true,
} as const

function dummyPasswordHash(): string {
  const salt = Buffer.alloc(16)
  const hash = pbkdf2Sync(
    'odbvue-invalid-user',
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_BYTES,
    'sha512',
  )
  return `${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$${salt.toString('hex').toUpperCase()}$${hash.toString('hex').toUpperCase()}`
}

function refreshCookie(
  token: PlsqlValue,
  options: Required<Pick<OdbAuthOptions, 'refreshCookieName' | 'refreshCookieSecure'>>,
  maxAge = REFRESH_TOKEN_MAX_AGE_SECONDS,
) {
  return odbHttp.setCookie({
    name: options.refreshCookieName,
    value: token,
    path: '/',
    httpOnly: true,
    secure: options.refreshCookieSecure,
    sameSite: 'Lax',
    maxAge,
  })
}

function expiredRefreshCookie(
  options: Required<Pick<OdbAuthOptions, 'refreshCookieName' | 'refreshCookieSecure'>>,
) {
  return refreshCookie(odbLiteral(''), options, 0)
}

export const authUsers = odbTable('odb_auth_users', (t) => ({
  id: t.guid().primaryKey().defaultSysGuid(),
  username: t.string(128).notNull(),
  passwordHash: t.string(512).notNull(),
  displayName: t.string(256),
  enabled: t.boolean().notNull().default(true),
  tokenVersion: t.number().notNull().default(0),
  createdAt: t.timestamp().notNull().defaultSysTimestamp(),
  updatedAt: t.timestamp().notNull().defaultSysTimestamp(),
})).unique('odb_auth_users_uq_username', (columns) => [columns.username])

export const authSessions = odbTable('odb_auth_sessions', (t) => ({
  id: t.guid().primaryKey().defaultSysGuid(),
  userId: t.guid().notNull(),
  refreshTokenHash: t.string(128).notNull(),
  previousRefreshTokenHash: t.string(128),
  expiresAt: t.timestamp().notNull(),
  revokedAt: t.timestamp(),
  createdAt: t.timestamp().notNull().defaultSysTimestamp(),
  lastUsedAt: t.timestamp(),
  userAgent: t.string(512),
  ipAddress: t.string(64),
}))
  .index('odb_auth_sessions_ix_user', (columns) => [columns.userId])
  .unique('odb_auth_sessions_uq_token', (columns) => [columns.refreshTokenHash])

/** Password and opaque token primitives used by `odb_auth`. */
export const odbAuthCrypto = odbPackage('odb_auth_crypto', (pkg) => {
  const deriveKey = pkg.privateFunc('derive_key', odbType.raw(PASSWORD_HASH_BYTES), (fn) => {
    const { passwordRaw, salt, iterations } = fn.parameters({
      in: {
        passwordRaw: odbType.raw(2000),
        salt: odbType.string(32),
        iterations: odbType.number(),
      },
    })
    fn.body((body) => {
      const { roundBlock, derivedKey } = body.variables({
        roundBlock: odbType.raw(PASSWORD_HASH_BYTES),
        derivedKey: odbType.raw(PASSWORD_HASH_BYTES),
      })
      body.set(
        roundBlock,
        odbDbmsCrypto.mac(
          odbUtlRaw.concat(odbOracle.hexToRaw(salt), odbOracle.hexToRaw(odbLiteral('00000001'))),
          odbDbmsCrypto.HMAC_SH512,
          passwordRaw,
        ),
      )
      body.set(derivedKey, roundBlock)
      body.forRange('round', 2, iterations, (_round, loop) => {
        loop.set(roundBlock, odbDbmsCrypto.mac(roundBlock, odbDbmsCrypto.HMAC_SH512, passwordRaw))
        loop.set(derivedKey, odbUtlRaw.bitXor(derivedKey, roundBlock))
      })
      body.return(derivedKey)
    })
  })

  return {
    hashPassword: pkg.func('hash_password', odbType.string(512), (fn) => {
      const { password } = fn.parameters({ in: { password: odbType.string() } })
      fn.body((body) => {
        const { salt, passwordRaw, hash } = body.variables({
          salt: odbType.string(32),
          passwordRaw: odbType.raw(2000),
          hash: odbType.string(128),
        })
        body.set(salt, odbOracle.rawToHex(odbDbmsCrypto.randomBytes(16)))
        body.set(passwordRaw, odbUtlI18n.stringToRaw(password, odbLiteral('AL32UTF8')))
        body.set(
          hash,
          odbOracle.rawToHex(
            deriveKey.invoke(passwordRaw, salt, odbLiteral(PASSWORD_HASH_ITERATIONS)),
          ),
        )
        body.return(
          plsqlExpr.concat(
            odbLiteral(`${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$`),
            salt,
            odbLiteral('$'),
            hash,
          ),
        )
      })
    }),
    verifyPassword: pkg.func('verify_password', odbType.boolean(), (fn) => {
      const { password, storedHash } = fn.parameters({
        in: { password: odbType.string(), storedHash: odbType.string() },
      })
      fn.body((body) => {
        const { iterations, salt, expectedHash, passwordRaw, derivedHash } = body.variables({
          iterations: odbType.number(),
          salt: odbType.string(32),
          expectedHash: odbType.string(128),
          passwordRaw: odbType.raw(2000),
          derivedHash: odbType.string(128),
        })
        body.ifThen(
          cond.not(
            cond.regexpLike(
              storedHash,
              `^${PASSWORD_HASH_ALGORITHM}\\$[1-9][0-9]*\\$[[:xdigit:]]{32}\\$[[:xdigit:]]{128}$`,
            ),
          ),
          (then) => then.return(false),
        )
        body.set(
          iterations,
          odbOracle.toNumber(
            odbOracle.regexpSubstr(
              storedHash,
              odbLiteral(`^${PASSWORD_HASH_ALGORITHM}\\$([1-9][0-9]*)\\$`),
              { position: 1, occurrence: 1, matchParameter: odbOracle.null(), subexpression: 1 },
            ),
          ),
        )
        body.set(
          salt,
          odbOracle.regexpSubstr(storedHash, odbLiteral('[[:xdigit:]]{32}'), {
            position: 1,
            occurrence: 1,
          }),
        )
        body.set(
          expectedHash,
          odbOracle.regexpSubstr(storedHash, odbLiteral('[[:xdigit:]]{128}'), {
            position: 1,
            occurrence: 1,
          }),
        )
        body.set(passwordRaw, odbUtlI18n.stringToRaw(password, odbLiteral('AL32UTF8')))
        body.set(derivedHash, odbOracle.rawToHex(deriveKey.invoke(passwordRaw, salt, iterations)))
        body.ifThen(cond.eq(derivedHash, expectedHash), (then) => then.return(true))
        body.return(false)
      })
    }),
    randomToken: pkg.func('random_token', odbType.string(512), (fn) => {
      const { bytes } = fn.parameters({ in: { bytes: odbType.number() } })
      fn.body((body) => body.return(odbOracle.rawToHex(odbDbmsCrypto.randomBytes(bytes))))
    }),
    hashToken: pkg.func('hash_token', odbType.string(128), (fn) => {
      const { token } = fn.parameters({ in: { token: odbType.string() } })
      fn.body((body) =>
        body.return(
          odbOracle.rawToHex(
            odbDbmsCrypto.hash(odbUtlRaw.castToRaw(token), odbDbmsCrypto.HASH_SH256),
          ),
        ),
      )
    }),
  }
})

/** Access-token wrapper around ODB's generic HS256 JWT implementation. */
export const odbAuthJwt = odbPackage('odb_auth_jwt', (pkg) => {
  const jwtSecret = pkg.privateConstant('c_jwt_secret', odbType.string(), 'jwtSecret')

  return {
    createAccessToken: pkg.func('create_access_token', odbType.string(4000), (fn) => {
      const { userId, sessionId, tokenVersion } = fn.parameters({
        in: { userId: odbType.guid(), sessionId: odbType.guid(), tokenVersion: odbType.number() },
      })
      fn.body((body) =>
        body.return(
          odbJwt.encode(
            plsqlExpr.jsonObject(
              {
                sub: userId,
                sid: sessionId,
                ver: tokenVersion,
                iat: odbJwt.toEpoch(),
                exp: plsqlExpr.add(odbJwt.toEpoch(), 900),
              },
              'VARCHAR2',
            ),
            jwtSecret,
          ),
        ),
      )
    }),
    requireUser: pkg.func('require_user', odbType.guid(), (fn) => {
      const { authorization } = fn.parameters({ in: { authorization: odbType.string() } })
      fn.body((body) => {
        const { token, subject, sessionId, tokenVersion, activeSessionCount } = body.variables({
          token: odbType.string(4000),
          subject: authUsers.id,
          sessionId: authSessions.id,
          tokenVersion: authUsers.tokenVersion,
          activeSessionCount: odbType.number(),
        })
        body.set(
          token,
          odbOracle.regexpReplace(
            authorization,
            odbLiteral('^Bearer[[:space:]]+'),
            odbLiteral(''),
            1,
            1,
            odbLiteral('i'),
          ),
        )
        body.ifThen(
          cond.or([
            cond.eq(odbJwt.verify(token, jwtSecret), 0),
            cond.eq(odbJwt.isExpired(token), 1),
          ]),
          (then) => then.unauthorized(),
        )
        body.set(subject, odbJwt.claim(token, odbLiteral('sub')))
        body.set(sessionId, odbJwt.claim(token, odbLiteral('sid')))
        body.set(tokenVersion, odbOracle.toNumber(odbJwt.claim(token, odbLiteral('ver'))))
        const sessions = authSessions.as('s')
        const users = authUsers.as('u')
        body.query(
          odbQuery()
            .selectFrom(sessions)
            .join(users, (expression) => expression(users.id, '=', sessions.userId))
            .select('COUNT(*)')
            .into(activeSessionCount)
            .where((expression) =>
              expression.and([
                expression(sessions.id, '=', sessionId),
                expression(sessions.userId, '=', subject),
                expression(sessions.revokedAt, 'IS NULL'),
                expression(sessions.expiresAt, '>', expression.ref('SYSTIMESTAMP')),
                expression(users.enabled, '=', 1),
                expression(users.tokenVersion, '=', tokenVersion),
              ]),
            ),
        )
        body.ifThen(cond.eq(activeSessionCount, 0), (then) => then.unauthorized())
        body.return(subject)
      })
    }),
  }
})

/** ORDS-facing authentication API. Refresh tokens never enter access JWTs. */
export const odbAuthApi = odbPackage('odb_auth', (pkg) => {
  const dummyPasswordHashConstant = pkg.privateConstant(
    'c_dummy_password_hash',
    odbType.string(512),
    'dummyPasswordHash',
  )

  const login = pkg.defineProcedure('login', {
    in: {
      loginUsername: authUsers.username,
      password: odbType.string(512),
    },
    out: {
      accessToken: odbType.clob(),
      setCookie: odbType.string(),
    },
  })
  const { loginUsername, password, accessToken, setCookie } = login.parameters
  login.body((statements) => {
    const { userId, passwordHash, tokenVersion, sessionId, refreshToken, loginSubject } =
      statements.variables({
        userId: authUsers.id,
        passwordHash: authUsers.passwordHash,
        tokenVersion: authUsers.tokenVersion,
        sessionId: authSessions.id,
        refreshToken: odbType.string(512),
        loginSubject: odbType.string(128),
      })
    statements.set(loginSubject, odbOracle.lower(odbOracle.trim(loginUsername)))
    statements.call(odbRateLimitApi.enforce(odbLiteral('AUTH_LOGIN_USERNAME'), loginSubject))
    statements.query(
      odbQuery()
        .selectFrom(authUsers)
        .select(['MAX(id)', 'MAX(password_hash)', 'MAX(token_version)'])
        .into(userId, passwordHash, tokenVersion)
        .where((expression) =>
          expression.and([
            expression(
              expression.fn('LOWER', expression.ref(authUsers.username)),
              '=',
              expression.fn('LOWER', expression.ref(loginUsername)),
            ),
            expression(authUsers.enabled, '=', 1),
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
    statements.set(refreshToken, odbAuthCrypto.randomToken(odbLiteral(REFRESH_TOKEN_BYTES)))
    statements.insertInto(authSessions, {
      id: sessionId,
      userId,
      refreshTokenHash: odbAuthCrypto.hashToken(refreshToken),
      expiresAt: odbOracle.plus(odbOracle.sysTimestamp(), odbOracle.interval.days(30)),
    })
    statements.set(
      accessToken,
      plsqlExpr.cast<'CLOB'>(odbAuthJwt.createAccessToken(userId, sessionId, tokenVersion)),
    )
    statements.set(setCookie, refreshCookie(refreshToken, authCookieOptions))
    statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized('INVALID_CREDENTIALS'))
  })
  defineService(login, {
    method: 'POST',
    path: '/login',
    basePath: '/auth',
    summary: 'Authenticate using username and password',
    params: {
      body: { username: 'loginUsername', password: 'password' },
      response: { accessToken: 'accessToken' },
      header: { 'Set-Cookie': 'setCookie' },
    },
  })

  const refresh = pkg.defineProcedure('refresh', {
    in: { cookieHeader: odbType.string(4000) },
    out: { accessToken: odbType.clob(), setCookie: odbType.string() },
  })
  const {
    cookieHeader: refreshCookieHeader,
    accessToken: refreshAccessToken,
    setCookie: refreshSetCookie,
  } = refresh.parameters
  refresh.body((statements) => {
    const {
      sessionId,
      userId,
      tokenVersion,
      previousRefreshTokenHash,
      presentedRefreshToken,
      presentedRefreshTokenHash,
      nextRefreshToken,
    } = statements.variables({
      sessionId: authSessions.id,
      userId: authUsers.id,
      tokenVersion: authUsers.tokenVersion,
      previousRefreshTokenHash: authSessions.previousRefreshTokenHash,
      presentedRefreshToken: odbType.string(512),
      presentedRefreshTokenHash: authSessions.refreshTokenHash,
      nextRefreshToken: odbType.string(512),
    })
    statements.set(
      presentedRefreshToken,
      odbOracle.regexpSubstr(
        refreshCookieHeader,
        odbLiteral(`(^|;[[:space:]]*)${authCookieOptions.refreshCookieName}=([^;]*)`),
        { position: 1, occurrence: 1, matchParameter: odbOracle.null(), subexpression: 2 },
      ),
    )
    statements.ifThen(
      cond.not(cond.regexpLike(presentedRefreshToken, '^[[:xdigit:]]{128}$')),
      (then) => then.unauthorized(),
    )
    statements.set(presentedRefreshTokenHash, odbAuthCrypto.hashToken(presentedRefreshToken))
    const sessions = authSessions.as('s')
    statements.query(
      odbQuery()
        .selectFrom(sessions)
        .select([sessions.id, sessions.userId, sessions.previousRefreshTokenHash])
        .into(sessionId, userId, previousRefreshTokenHash)
        .where((expression) =>
          expression.and([
            expression.or([
              expression(sessions.refreshTokenHash, '=', presentedRefreshTokenHash),
              expression(sessions.previousRefreshTokenHash, '=', presentedRefreshTokenHash),
            ]),
            expression(sessions.revokedAt, 'IS NULL'),
            expression(sessions.expiresAt, '>', expression.ref('SYSTIMESTAMP')),
          ]),
        )
        .forUpdate(),
    )
    statements.query(
      odbQuery()
        .selectFrom(authUsers)
        .select(authUsers.tokenVersion)
        .into(tokenVersion)
        .where((expression) =>
          expression.and([
            expression(authUsers.id, '=', userId),
            expression(authUsers.enabled, '=', 1),
          ]),
        ),
    )
    statements.ifThen(cond.eq(presentedRefreshTokenHash, previousRefreshTokenHash), (then) => {
      then.query(
        odbQuery()
          .updateTable(authSessions)
          .set({ revokedAt: odbOracle.sysTimestamp() })
          .where((expression) => expression(authSessions.id, '=', sessionId)),
      )
      then.unauthorized()
    })
    statements.set(nextRefreshToken, odbAuthCrypto.randomToken(odbLiteral(REFRESH_TOKEN_BYTES)))
    statements.query(
      odbQuery()
        .updateTable(authSessions)
        .set({
          previousRefreshTokenHash: presentedRefreshTokenHash,
          refreshTokenHash: odbAuthCrypto.hashToken(nextRefreshToken),
          lastUsedAt: odbOracle.sysTimestamp(),
        })
        .where((expression) => expression(authSessions.id, '=', sessionId)),
    )
    statements.set(
      refreshAccessToken,
      plsqlExpr.cast<'CLOB'>(odbAuthJwt.createAccessToken(userId, sessionId, tokenVersion)),
    )
    statements.set(refreshSetCookie, refreshCookie(nextRefreshToken, authCookieOptions))
    statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized())
  })
  defineService(refresh, {
    method: 'POST',
    path: '/refresh',
    basePath: '/auth',
    summary: 'Rotate a refresh token and issue an access token',
    params: {
      header: { Cookie: 'cookieHeader', 'Set-Cookie': 'setCookie' },
      response: { accessToken: 'accessToken' },
    },
  })

  const logout = pkg.defineProcedure('logout', {
    in: { cookieHeader: odbType.string(4000) },
    out: { setCookie: odbType.string() },
  })
  const { cookieHeader: logoutCookieHeader, setCookie: logoutSetCookie } = logout.parameters
  logout.body((statements) => {
    const { presentedRefreshToken } = statements.variables({
      presentedRefreshToken: odbType.string(512),
    })
    statements.set(
      presentedRefreshToken,
      odbOracle.regexpSubstr(
        logoutCookieHeader,
        odbLiteral(`(^|;[[:space:]]*)${authCookieOptions.refreshCookieName}=([^;]*)`),
        { position: 1, occurrence: 1, matchParameter: odbOracle.null(), subexpression: 2 },
      ),
    )
    statements.query(
      odbQuery()
        .updateTable(authSessions)
        .set({ revokedAt: odbOracle.sysTimestamp() })
        .where((expression) =>
          expression.and([
            expression('refresh_token_hash', '=', odbAuthCrypto.hashToken(presentedRefreshToken)),
            expression('revoked_at', 'IS NULL'),
          ]),
        ),
    )
    statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized())
    statements.set(logoutSetCookie, expiredRefreshCookie(authCookieOptions))
  })
  defineService(logout, {
    method: 'POST',
    path: '/logout',
    basePath: '/auth',
    summary: 'Revoke an authentication session',
    params: { header: { Cookie: 'cookieHeader', 'Set-Cookie': 'setCookie' } },
  })

  const me = pkg.defineProcedure('me', {
    in: { authorization: odbType.string(4000) },
    out: {
      userId: authUsers.id,
      username: authUsers.username,
      displayName: authUsers.displayName,
    },
  })
  const { authorization, userId, username, displayName } = me.parameters
  me.body((statements) => {
    const { subject } = statements.variables({ subject: authUsers.id })
    statements.set(subject, odbAuthJwt.requireUser(authorization))
    statements.query(
      odbQuery()
        .selectFrom(authUsers)
        .select([authUsers.id, authUsers.username, authUsers.displayName])
        .into(userId, username, displayName)
        .where((expression) =>
          expression.and([
            expression(authUsers.id, '=', subject),
            expression(authUsers.enabled, '=', 1),
          ]),
        ),
    )
  })
  defineService(me, {
    method: 'GET',
    path: '/me',
    basePath: '/auth',
    summary: 'Return the authenticated user',
    params: {
      header: { Authorization: 'authorization' },
      response: { userId: 'userId', username: 'username', displayName: 'displayName' },
    },
  })

  return {
    login: login.procedure,
    refresh: refresh.procedure,
    logout: logout.procedure,
    me: me.procedure,
  }
})

export interface OdbAuthOptions {
  jwtSecret?: string
  refreshCookieName?: string
  refreshCookieSecure?: boolean
}

/** Installable framework artifact: tables, primitives, ORDS API, and auth OpenAPI contract. */
export const odbAuth = {
  toSQLUp(options: { schema?: string; jwtSecret?: string } = {}): string {
    const secret = options.jwtSecret ?? process.env.ODBVUE_AUTH_JWT_SECRET ?? DEFAULT_JWT_SECRET
    if (secret.length < 32) throw new Error('odbAuth: jwtSecret must be at least 32 characters.')
    return [
      authUsers.toSQLUp(options),
      authSessions.toSQLUp(options),
      odbJwt.toSQLUp(options),
      odbHttp.toSQLUp(options),
      odbAuthCrypto.toSQLUp(options),
      odbAuthJwt.toSQLUp({ ...options, substitutions: { jwtSecret: secret } }),
      odbAuthApi.toSQLUp({ ...options, substitutions: { dummyPasswordHash: dummyPasswordHash() } }),
    ].join('\n')
  },
  upgrade() {
    return {
      toSQLUp(options: { schema?: string } = {}): string {
        const sessions = qualify('odb_auth_sessions', options.schema)
        return [
          odbRateLimit.upgrade().toSQLUp(options),
          'BEGIN',
          `  EXECUTE IMMEDIATE 'ALTER TABLE ${sessions} ADD (previous_refresh_token_hash VARCHAR2(128 CHAR))';`,
          'EXCEPTION WHEN OTHERS THEN',
          '  IF SQLCODE != -1430 THEN RAISE; END IF;',
          'END;',
          '/',
          odbAuthApi.toSQLUp({
            ...options,
            substitutions: { dummyPasswordHash: dummyPasswordHash() },
          }),
        ].join('\n')
      },
      toSQLDown() {
        return ''
      },
      application() {
        return odbAuthApi.application()
      },
    }
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [odbAuthApi, odbAuthJwt, odbAuthCrypto, odbHttp, odbJwt, authSessions, authUsers]
      .map((artifact) => artifact.toSQLDown(options))
      .join('\n')
  },
  application() {
    return odbAuthApi.application()
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
          .on((target, source, expression) =>
            expression(
              expression.fn('LOWER', target.username),
              '=',
              expression.fn('LOWER', source.username),
            ),
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
