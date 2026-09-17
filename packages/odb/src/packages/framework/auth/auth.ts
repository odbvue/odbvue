import { pbkdf2Sync } from 'node:crypto'
import { odbPackage, odbType } from '../../../schema/package.js'
import { cond, odbLiteral, plsqlExpr, type PlsqlValue } from '../../../schema/attribute.js'
import { odbTable } from '../../../schema/table.js'
import { odbQuery } from '../../../query/index.js'
import { odbDbmsCrypto, odbOracle, odbUtlI18n, odbUtlRaw } from '../../oracle/index.js'
import { odbHttp } from '../http/http.js'
import { odbJwt } from '../jwt/jwt.js'
import { odbRateLimit, odbRateLimitApi } from '../rate-limit/rate-limit.js'

const AUTH_JWT_SECRET_MARKER = '__ODB_AUTH_JWT_SECRET__'
const DEFAULT_JWT_SECRET = 'change-this-development-only-odbvue-auth-secret-2026'
const PASSWORD_HASH_ALGORITHM = 'pbkdf2-sha512'
const PASSWORD_HASH_ITERATIONS = 210000
const PASSWORD_HASH_BYTES = 64
const REFRESH_TOKEN_BYTES = 64
const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const DUMMY_PASSWORD_HASH_MARKER = '__ODB_AUTH_DUMMY_PASSWORD_HASH__'
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

function qualify(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

function block(statement: string): string {
  return ['BEGIN', `  ${statement};`, 'END;', '/'].join('\n')
}

function refreshCookie(
  token: PlsqlValue,
  options: Required<Pick<OdbAuthOptions, 'refreshCookieName' | 'refreshCookieSecure'>>,
  maxAge = REFRESH_TOKEN_MAX_AGE_SECONDS,
) {
  return plsqlExpr.concat(
    odbLiteral(`${options.refreshCookieName}=`),
    token,
    odbLiteral('; '),
    odbLiteral('Path=/'),
    odbLiteral('; '),
    odbLiteral('HttpOnly'),
    ...(options.refreshCookieSecure ? [odbLiteral('; '), odbLiteral('Secure')] : []),
    odbLiteral('; '),
    odbLiteral('SameSite=Lax'),
    odbLiteral('; '),
    odbLiteral(`Max-Age=${maxAge}`),
  )
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
export const odbAuthCrypto = odbPackage('odb_auth_crypto', (pkg) => ({
  hashPassword: pkg.func('hash_password', odbType.string(512), (fn) => {
    const password = fn.param('p_password', odbType.string())
    fn.body((body) => {
      const { salt, passwordRaw, roundBlock, derivedKey, hash } = body.variables({
        salt: odbType.string(32),
        passwordRaw: odbType.raw(2000),
        roundBlock: odbType.raw(PASSWORD_HASH_BYTES),
        derivedKey: odbType.raw(PASSWORD_HASH_BYTES),
        hash: odbType.string(128),
      })
      body.set(salt, odbOracle.rawToHex(odbDbmsCrypto.randomBytes(16)))
      body.set(passwordRaw, odbUtlI18n.stringToRaw(password, odbLiteral('AL32UTF8')))
      body.set(
        roundBlock,
        odbDbmsCrypto.mac(
          odbUtlRaw.concat(odbOracle.hexToRaw(salt), odbOracle.hexToRaw(odbLiteral('00000001'))),
          odbDbmsCrypto.HMAC_SH512,
          passwordRaw,
        ),
      )
      body.set(derivedKey, roundBlock)
      body.forRange('round', 2, PASSWORD_HASH_ITERATIONS, (_round, loop) => {
        loop.set(roundBlock, odbDbmsCrypto.mac(roundBlock, odbDbmsCrypto.HMAC_SH512, passwordRaw))
        loop.set(derivedKey, odbUtlRaw.bitXor(derivedKey, roundBlock))
      })
      body.set(hash, odbOracle.rawToHex(derivedKey))
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
  verifyPassword: pkg.func('verify_password', odbType.number(), (fn) => {
    const password = fn.param('p_password', odbType.string())
    const storedHash = fn.param('p_password_hash', odbType.string())
    fn.body((body) => {
      const { iterations, salt, expectedHash, passwordRaw, roundBlock, derivedKey, derivedHash } =
        body.variables({
          iterations: odbType.number(),
          salt: odbType.string(32),
          expectedHash: odbType.string(128),
          passwordRaw: odbType.raw(2000),
          roundBlock: odbType.raw(PASSWORD_HASH_BYTES),
          derivedKey: odbType.raw(PASSWORD_HASH_BYTES),
          derivedHash: odbType.string(128),
        })
      body.ifThen(
        cond.not(
          cond.regexpLike(
            storedHash,
            `^${PASSWORD_HASH_ALGORITHM}\\$[1-9][0-9]*\\$[[:xdigit:]]{32}\\$[[:xdigit:]]{128}$`,
          ),
        ),
        (then) => then.return('0'),
      )
      body.set(
        iterations,
        odbOracle.toNumber(
          odbOracle.regexpSubstr(
            storedHash,
            odbLiteral(`^${PASSWORD_HASH_ALGORITHM}\\$([1-9][0-9]*)\\$`),
            1,
            1,
            odbOracle.null(),
            1,
          ),
        ),
      )
      body.set(salt, odbOracle.regexpSubstr(storedHash, odbLiteral('[[:xdigit:]]{32}'), 1, 1))
      body.set(
        expectedHash,
        odbOracle.regexpSubstr(storedHash, odbLiteral('[[:xdigit:]]{128}'), 1, 1),
      )
      body.set(passwordRaw, odbUtlI18n.stringToRaw(password, odbLiteral('AL32UTF8')))
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
      body.set(derivedHash, odbOracle.rawToHex(derivedKey))
      body.ifThen(cond.eq(derivedHash, expectedHash), (then) => then.return('1'))
      body.return('0')
    })
  }),
  randomToken: pkg.func('random_token', odbType.string(512), (fn) => {
    const bytes = fn.param('p_bytes', odbType.number())
    fn.body((body) => body.return(odbOracle.rawToHex(odbDbmsCrypto.randomBytes(bytes))))
  }),
  hashToken: pkg.func('hash_token', odbType.string(128), (fn) => {
    const token = fn.param('p_token', odbType.string())
    fn.body((body) =>
      body.return(
        odbOracle.rawToHex(
          odbDbmsCrypto.hash(odbUtlRaw.castToRaw(token), odbDbmsCrypto.HASH_SH256),
        ),
      ),
    )
  }),
}))

/** Access-token wrapper around ODB's generic HS256 JWT implementation. */
export const odbAuthJwt = odbPackage('odb_auth_jwt', (pkg) => ({
  createAccessToken: pkg.func('create_access_token', odbType.string(4000), (fn) => {
    const userId = fn.param('p_user_id', odbType.guid())
    const sessionId = fn.param('p_session_id', odbType.guid())
    const tokenVersion = fn.param('p_token_version', odbType.number())
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
          odbLiteral(AUTH_JWT_SECRET_MARKER),
        ),
      ),
    )
  }),
  requireUser: pkg.func('require_user', odbType.guid(), (fn) => {
    const authorization = fn.param('p_authorization', odbType.string())
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
          cond.eq(odbJwt.verify(token, odbLiteral(AUTH_JWT_SECRET_MARKER)), 0),
          cond.eq(odbJwt.isExpired(token), 1),
        ]),
        (then) => then.unauthorized(),
      )
      body.set(subject, odbJwt.claim(token, odbLiteral('sub')))
      body.set(sessionId, odbJwt.claim(token, odbLiteral('sid')))
      body.set(tokenVersion, odbOracle.toNumber(odbJwt.claim(token, odbLiteral('ver'))))
      body.query(
        odbQuery()
          .selectFrom('odb_auth_sessions s JOIN odb_auth_users u ON u.id = s.user_id')
          .select('COUNT(*)')
          .into(activeSessionCount.name)
          .where((expression) =>
            expression.and([
              expression('s.id', '=', sessionId),
              expression('s.user_id', '=', subject),
              expression('s.revoked_at', 'IS NULL'),
              expression('s.expires_at', '>', expression.ref('SYSTIMESTAMP')),
              expression('u.enabled', '=', 1),
              expression('u.token_version', '=', tokenVersion),
            ]),
          ),
      )
      body.ifThen(cond.eq(activeSessionCount, 0), (then) => then.unauthorized())
      body.return(subject.name)
    })
  }),
}))

/** ORDS-facing authentication API. Refresh tokens never enter access JWTs. */
export const odbAuthApi = odbPackage('odb_auth', (pkg) => ({
  login: pkg.proc('login', (proc) => {
    const { loginUsername, password, accessToken, setCookie } = proc.parameters({
      in: {
        loginUsername: authUsers.username,
        password: odbType.string(512),
      },
      out: {
        accessToken: odbType.clob(),
        setCookie: odbType.string(),
      },
    })
    proc
      .body((statements) => {
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
                  expression.fn('LOWER', expression.ref(authUsers.username.name)),
                  '=',
                  expression.fn('LOWER', expression.ref(loginUsername.name)),
                ),
                expression(authUsers.enabled, '=', 1),
              ]),
            ),
        )
        statements.set(
          passwordHash,
          odbOracle.nvl(passwordHash, odbLiteral(DUMMY_PASSWORD_HASH_MARKER)),
        )
        statements.ifThen(
          cond.or([
            cond.eq(odbAuthCrypto.verifyPassword(password, passwordHash), 0),
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
      .service({
        method: 'POST',
        path: '/login',
        basePath: '/auth',
        summary: 'Authenticate using username and password',
        params: {
          body: { username: loginUsername, password },
          response: { accessToken },
          header: { 'Set-Cookie': setCookie },
        },
      })
  }),
  refresh: pkg.proc('refresh', (proc) => {
    const { cookieHeader, accessToken, setCookie } = proc.parameters({
      in: { cookieHeader: odbType.string(4000) },
      out: { accessToken: odbType.clob(), setCookie: odbType.string() },
    })
    proc
      .body((statements) => {
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
            cookieHeader,
            odbLiteral(`(^|;[[:space:]]*)${authCookieOptions.refreshCookieName}=([^;]*)`),
            1,
            1,
            odbOracle.null(),
            2,
          ),
        )
        statements.ifThen(
          cond.not(cond.regexpLike(presentedRefreshToken, '^[[:xdigit:]]{128}$')),
          (then) => then.unauthorized(),
        )
        statements.set(presentedRefreshTokenHash, odbAuthCrypto.hashToken(presentedRefreshToken))
        statements.query(
          odbQuery()
            .selectFrom('odb_auth_sessions s')
            .select(['s.id', 's.user_id', 's.previous_refresh_token_hash'])
            .into(sessionId, userId, previousRefreshTokenHash)
            .where((expression) =>
              expression.and([
                expression.or([
                  expression('s.refresh_token_hash', '=', presentedRefreshTokenHash),
                  expression('s.previous_refresh_token_hash', '=', presentedRefreshTokenHash),
                ]),
                expression('s.revoked_at', 'IS NULL'),
                expression('s.expires_at', '>', expression.ref('SYSTIMESTAMP')),
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
          accessToken,
          plsqlExpr.cast<'CLOB'>(odbAuthJwt.createAccessToken(userId, sessionId, tokenVersion)),
        )
        statements.set(setCookie, refreshCookie(nextRefreshToken, authCookieOptions))
        statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized())
      })
      .service({
        method: 'POST',
        path: '/refresh',
        basePath: '/auth',
        summary: 'Rotate a refresh token and issue an access token',
        params: {
          header: { Cookie: cookieHeader, 'Set-Cookie': setCookie },
          response: { accessToken },
        },
      })
  }),
  logout: pkg.proc('logout', (proc) => {
    const { cookieHeader, setCookie } = proc.parameters({
      in: { cookieHeader: odbType.string(4000) },
      out: { setCookie: odbType.string() },
    })
    proc
      .body((statements) => {
        const { presentedRefreshToken } = statements.variables({
          presentedRefreshToken: odbType.string(512),
        })
        statements.set(
          presentedRefreshToken,
          odbOracle.regexpSubstr(
            cookieHeader,
            odbLiteral(`(^|;[[:space:]]*)${authCookieOptions.refreshCookieName}=([^;]*)`),
            1,
            1,
            odbOracle.null(),
            2,
          ),
        )
        statements.query(
          odbQuery()
            .updateTable(authSessions)
            .set({ revokedAt: odbOracle.sysTimestamp() })
            .where((expression) =>
              expression.and([
                expression(
                  'refresh_token_hash',
                  '=',
                  odbAuthCrypto.hashToken(presentedRefreshToken),
                ),
                expression('revoked_at', 'IS NULL'),
              ]),
            ),
        )
        statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized())
        statements.set(setCookie, expiredRefreshCookie(authCookieOptions))
      })
      .service({
        method: 'POST',
        path: '/logout',
        basePath: '/auth',
        summary: 'Revoke an authentication session',
        params: {
          header: { Cookie: cookieHeader, 'Set-Cookie': setCookie },
        },
      })
  }),
  me: pkg.proc('me', (proc) => {
    const { authorization, userId, username, displayName } = proc.parameters({
      in: { authorization: odbType.string(4000) },
      out: {
        userId: authUsers.id,
        username: authUsers.username,
        displayName: authUsers.displayName,
      },
    })
    proc
      .body((statements) => {
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
      .service({
        method: 'GET',
        path: '/me',
        basePath: '/auth',
        summary: 'Return the authenticated user',
        params: {
          header: { Authorization: authorization },
          response: { userId, username, displayName },
        },
      })
  }),
}))

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
      odbAuthJwt.toSQLUp(options).replaceAll(AUTH_JWT_SECRET_MARKER, secret.replace(/'/g, "''")),
      odbAuthApi.toSQLUp(options).replaceAll(DUMMY_PASSWORD_HASH_MARKER, dummyPasswordHash()),
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
          odbAuthApi.toSQLUp(options).replaceAll(DUMMY_PASSWORD_HASH_MARKER, dummyPasswordHash()),
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
        const table = qualify('odb_auth_users', options.schema)
        const crypto = qualify('odb_auth_crypto', options.schema)
        return block(
          `MERGE INTO ${table} target USING (SELECT ${odbLiteral(user.username).toSQL()} username FROM dual) source ON (LOWER(target.username) = LOWER(source.username)) WHEN MATCHED THEN UPDATE SET target.password_hash = ${crypto}.hash_password(${odbLiteral(user.password).toSQL()}), target.display_name = ${odbLiteral(user.displayName ?? user.username).toSQL()}, target.enabled = 1, target.token_version = target.token_version + 1, target.updated_at = SYSTIMESTAMP WHEN NOT MATCHED THEN INSERT (username, password_hash, display_name, enabled, token_version) VALUES (${odbLiteral(user.username).toSQL()}, ${crypto}.hash_password(${odbLiteral(user.password).toSQL()}), ${odbLiteral(user.displayName ?? user.username).toSQL()}, 1, 0)`,
        )
      },
      toSQLDown() {
        return ''
      },
    }
  },
}
