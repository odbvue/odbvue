import { odbPackage, odbType } from '../../../schema/package.js'
import { PlsqlExpression } from '../../../schema/attribute.js'
import { odbTable } from '../../../schema/table.js'
import { odbQuery } from '../../../query/index.js'
import { odbHttp } from '../http/http.js'
import { odbJwt } from '../jwt/jwt.js'

const AUTH_JWT_SECRET_MARKER = '__ODB_AUTH_JWT_SECRET__'
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

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function qualify(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

function block(statement: string): string {
  return ['BEGIN', `  ${statement};`, 'END;', '/'].join('\n')
}

function refreshCookie(
  token: string,
  options: Required<Pick<OdbAuthOptions, 'refreshCookieName' | 'refreshCookieSecure'>>,
): string {
  return [
    `'${options.refreshCookieName}=' || ${token}`,
    "'Path=/'",
    "'HttpOnly'",
    ...(options.refreshCookieSecure ? ["'Secure'"] : []),
    "'SameSite=Lax'",
    `'Max-Age=${REFRESH_TOKEN_MAX_AGE_SECONDS}'`,
  ].join(" || '; ' || ")
}

function expiredRefreshCookie(
  options: Required<Pick<OdbAuthOptions, 'refreshCookieName' | 'refreshCookieSecure'>>,
): string {
  return refreshCookie("''", options).replace(
    `'Max-Age=${REFRESH_TOKEN_MAX_AGE_SECONDS}'`,
    "'Max-Age=0'",
  )
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
  hashPassword: pkg.func('hash_password', 'VARCHAR2', (fn) => {
    const password = fn.in('p_password', 'VARCHAR2')
    fn.returnLength(512).body((body) => {
      const salt = body.variable('l_salt', 'VARCHAR2', 32)
      const passwordRaw = body.variable('l_password_raw', 'RAW(2000)')
      const round = body.variable('l_round', 'PLS_INTEGER')
      const roundBlock = body.variable('l_block', `RAW(${PASSWORD_HASH_BYTES})`)
      const derivedKey = body.variable('l_derived_key', `RAW(${PASSWORD_HASH_BYTES})`)
      const hash = body.variable('l_hash', 'VARCHAR2', 128)
      body.assign(salt, 'RAWTOHEX(DBMS_CRYPTO.RANDOMBYTES(16))')
      body.assign(passwordRaw, `UTL_I18N.STRING_TO_RAW(${password.name}, 'AL32UTF8')`)
      body.raw(
        `${roundBlock.name} := DBMS_CRYPTO.MAC(UTL_RAW.CONCAT(HEXTORAW(${salt.name}), HEXTORAW('00000001')), DBMS_CRYPTO.HMAC_SH512, ${passwordRaw.name});\n${derivedKey.name} := ${roundBlock.name};\nFOR ${round.name} IN 2..${PASSWORD_HASH_ITERATIONS} LOOP\n  ${roundBlock.name} := DBMS_CRYPTO.MAC(${roundBlock.name}, DBMS_CRYPTO.HMAC_SH512, ${passwordRaw.name});\n  ${derivedKey.name} := UTL_RAW.BIT_XOR(${derivedKey.name}, ${roundBlock.name});\nEND LOOP`,
      )
      body.assign(hash, `RAWTOHEX(${derivedKey.name})`)
      body.return(
        `'${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$' || ${salt.name} || '$' || ${hash.name}`,
      )
    })
  }),
  verifyPassword: pkg.func('verify_password', 'NUMBER', (fn) => {
    const password = fn.in('p_password', 'VARCHAR2')
    const storedHash = fn.in('p_password_hash', 'VARCHAR2')
    fn.body((body) => {
      const iterations = body.variable('l_iterations', 'NUMBER')
      const salt = body.variable('l_salt', 'VARCHAR2', 32)
      const expectedHash = body.variable('l_expected_hash', 'VARCHAR2', 128)
      const passwordRaw = body.variable('l_password_raw', 'RAW(2000)')
      const round = body.variable('l_round', 'PLS_INTEGER')
      const roundBlock = body.variable('l_block', `RAW(${PASSWORD_HASH_BYTES})`)
      const derivedKey = body.variable('l_derived_key', `RAW(${PASSWORD_HASH_BYTES})`)
      const derivedHash = body.variable('l_derived_hash', 'VARCHAR2', 128)
      body.ifThen(
        `NOT REGEXP_LIKE(${storedHash.name}, '^${PASSWORD_HASH_ALGORITHM}\\$[1-9][0-9]*\\$[[:xdigit:]]{32}\\$[[:xdigit:]]{128}$')`,
        (then) => then.return('0'),
      )
      body.assign(
        iterations,
        `TO_NUMBER(REGEXP_SUBSTR(${storedHash.name}, '^${PASSWORD_HASH_ALGORITHM}\\$([1-9][0-9]*)\\$', 1, 1, NULL, 1))`,
      )
      body.assign(salt, `REGEXP_SUBSTR(${storedHash.name}, '[[:xdigit:]]{32}', 1, 1)`)
      body.assign(expectedHash, `REGEXP_SUBSTR(${storedHash.name}, '[[:xdigit:]]{128}', 1, 1)`)
      body.assign(passwordRaw, `UTL_I18N.STRING_TO_RAW(${password.name}, 'AL32UTF8')`)
      body.raw(
        `${roundBlock.name} := DBMS_CRYPTO.MAC(UTL_RAW.CONCAT(HEXTORAW(${salt.name}), HEXTORAW('00000001')), DBMS_CRYPTO.HMAC_SH512, ${passwordRaw.name});\n${derivedKey.name} := ${roundBlock.name};\nFOR ${round.name} IN 2..${iterations.name} LOOP\n  ${roundBlock.name} := DBMS_CRYPTO.MAC(${roundBlock.name}, DBMS_CRYPTO.HMAC_SH512, ${passwordRaw.name});\n  ${derivedKey.name} := UTL_RAW.BIT_XOR(${derivedKey.name}, ${roundBlock.name});\nEND LOOP`,
      )
      body.assign(derivedHash, `RAWTOHEX(${derivedKey.name})`)
      body.ifThen(`${derivedHash.name} = ${expectedHash.name}`, (then) => then.return('1'))
      body.return('0')
    })
  }),
  randomToken: pkg.func('random_token', 'VARCHAR2', (fn) => {
    const bytes = fn.in('p_bytes', 'NUMBER')
    fn.returnLength(512).body((body) =>
      body.return(`RAWTOHEX(DBMS_CRYPTO.RANDOMBYTES(${bytes.name}))`),
    )
  }),
  hashToken: pkg.func('hash_token', 'VARCHAR2', (fn) => {
    const token = fn.in('p_token', 'VARCHAR2')
    fn.returnLength(128).body((body) =>
      body.return(
        `RAWTOHEX(DBMS_CRYPTO.HASH(UTL_RAW.CAST_TO_RAW(${token.name}), DBMS_CRYPTO.HASH_SH256))`,
      ),
    )
  }),
}))

/** Access-token wrapper around ODB's generic HS256 JWT implementation. */
export const odbAuthJwt = odbPackage('odb_auth_jwt', (pkg) => ({
  createAccessToken: pkg.func('create_access_token', 'VARCHAR2', (fn) => {
    const userId = fn.in('p_user_id', 'VARCHAR2')
    const sessionId = fn.in('p_session_id', 'VARCHAR2')
    const tokenVersion = fn.in('p_token_version', 'NUMBER')
    fn.returnLength(4000).body((body) =>
      body.return(
        `odb_jwt.encode(JSON_OBJECT('sub' VALUE ${userId.name}, 'sid' VALUE ${sessionId.name}, 'ver' VALUE ${tokenVersion.name}, 'iat' VALUE odb_jwt.to_epoch(), 'exp' VALUE odb_jwt.to_epoch() + 900 RETURNING VARCHAR2), '${AUTH_JWT_SECRET_MARKER}')`,
      ),
    )
  }),
  requireUser: pkg.func('require_user', 'VARCHAR2', (fn) => {
    const authorization = fn.in('p_authorization', 'VARCHAR2')
    fn.body((body) => {
      const token = body.variable('l_token', 'VARCHAR2', 4000)
      const subject = body.variable('l_subject', 'VARCHAR2', 32)
      const sessionId = body.variable('l_session_id', 'VARCHAR2', 32)
      const tokenVersion = body.variable('l_token_version', 'NUMBER')
      const activeSessionCount = body.variable('l_active_session_count', 'NUMBER')
      body.assign(
        token,
        `REGEXP_REPLACE(${authorization.name}, '^Bearer[[:space:]]+', '', 1, 1, 'i')`,
      )
      body.ifThen(
        `odb_jwt.verify(${token.name}, '${AUTH_JWT_SECRET_MARKER}') = 0 OR odb_jwt.is_expired(${token.name}) = 1`,
        (then) => then.unauthorized(),
      )
      body.assign(subject, `odb_jwt.claim(${token.name}, 'sub')`)
      body.assign(sessionId, `odb_jwt.claim(${token.name}, 'sid')`)
      body.assign(tokenVersion, `TO_NUMBER(odb_jwt.claim(${token.name}, 'ver'))`)
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
              expression.raw('s.expires_at > SYSTIMESTAMP'),
              expression('u.enabled', '=', 1),
              expression('u.token_version', '=', tokenVersion),
            ]),
          ),
      )
      body.ifThen(`${activeSessionCount.name} = 0`, (then) => then.unauthorized())
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
        password: odbType.string(),
      },
      out: {
        accessToken: odbType.clob(),
        setCookie: odbType.string(),
      },
    })
    proc
      .body((statements) => {
        const { userId, passwordHash, tokenVersion, sessionId, refreshToken } =
          statements.variables({
            userId: authUsers.id,
            passwordHash: authUsers.passwordHash,
            tokenVersion: authUsers.tokenVersion,
            sessionId: authSessions.id,
            refreshToken: odbType.string(512),
          })
        statements.query(
          odbQuery()
            .selectFrom(authUsers)
            .select([authUsers.id, authUsers.passwordHash, authUsers.tokenVersion])
            .into(userId, passwordHash, tokenVersion)
            .where((expression) =>
              expression.and([
                expression(
                  expression.fn('LOWER', expression.ref(authUsers.username.name)),
                  '=',
                  expression.fn('LOWER', expression.raw(loginUsername.name)),
                ),
                expression(authUsers.enabled, '=', 1),
              ]),
            ),
        )
        statements.ifThen(
          `odb_auth_crypto.verify_password(${password.name}, ${passwordHash.name}) = 0`,
          (then) => then.unauthorized('INVALID_CREDENTIALS'),
        )
        statements.assign(sessionId, 'LOWER(RAWTOHEX(SYS_GUID()))')
        statements.assign(refreshToken, `odb_auth_crypto.random_token(${REFRESH_TOKEN_BYTES})`)
        statements.insertInto(authSessions, {
          id: sessionId,
          userId,
          refreshTokenHash: odbAuthCrypto.hashToken(refreshToken),
          expiresAt: new PlsqlExpression('TIMESTAMP', "SYSTIMESTAMP + INTERVAL '30' DAY"),
        })
        statements.assign(
          accessToken,
          `odb_auth_jwt.create_access_token(${userId.name}, ${sessionId.name}, ${tokenVersion.name})`,
        )
        statements.assign(setCookie, refreshCookie(refreshToken.name, authCookieOptions))
        statements.when('NO_DATA_FOUND', (handler) => handler.unauthorized('INVALID_CREDENTIALS'))
      })
      .service({
        method: 'POST',
        path: '/login',
        basePath: '/auth',
        summary: 'Authenticate using username and password',
        params: {
          body: { username: loginUsername },
          response: { accessToken },
          header: { 'Set-Cookie': setCookie },
        },
      })
  }),
  refresh: pkg.proc('refresh', (proc) => {
    const cookieHeader = proc.in('p_cookie_header', 'VARCHAR2')
    const accessToken = proc.out('p_access_token', 'CLOB')
    const setCookie = proc.out('p_set_cookie', 'VARCHAR2')
    proc
      .body((statements) => {
        const sessionId = statements.variable('l_session_id', 'VARCHAR2', 32)
        const userId = statements.variable('l_user_id', 'VARCHAR2', 32)
        const tokenVersion = statements.variable('l_token_version', 'NUMBER')
        const presentedRefreshToken = statements.variable(
          'l_presented_refresh_token',
          'VARCHAR2',
          512,
        )
        const nextToken = statements.variable('l_next_refresh_token', 'VARCHAR2', 512)
        statements.assign(
          presentedRefreshToken,
          `REGEXP_SUBSTR(${cookieHeader.name}, '(^|;[[:space:]]*)${authCookieOptions.refreshCookieName}=([^;]*)', 1, 1, NULL, 2)`,
        )
        statements.ifThen(
          `NOT REGEXP_LIKE(${presentedRefreshToken.name}, '^[[:xdigit:]]{128}$')`,
          (then) => then.unauthorized(),
        )
        statements.query(
          odbQuery()
            .selectFrom('odb_auth_sessions s JOIN odb_auth_users u ON u.id = s.user_id')
            .select(['s.id', 's.user_id', 'u.token_version'])
            .into(sessionId, userId, tokenVersion)
            .where((expression) =>
              expression.and([
                expression(
                  's.refresh_token_hash',
                  '=',
                  odbAuthCrypto.hashToken(presentedRefreshToken),
                ),
                expression('s.revoked_at', 'IS NULL'),
                expression.raw('s.expires_at > SYSTIMESTAMP'),
                expression('u.enabled', '=', 1),
              ]),
            )
            .forUpdate(),
        )
        statements.assign(nextToken, `odb_auth_crypto.random_token(${REFRESH_TOKEN_BYTES})`)
        statements.query(
          odbQuery()
            .updateTable(authSessions)
            .set({
              refreshTokenHash: odbAuthCrypto.hashToken(nextToken),
              lastUsedAt: new PlsqlExpression('TIMESTAMP', 'SYSTIMESTAMP'),
            })
            .where((expression) => expression(authSessions.id, '=', sessionId)),
        )
        statements.assign(
          accessToken,
          `odb_auth_jwt.create_access_token(${userId.name}, ${sessionId.name}, ${tokenVersion.name})`,
        )
        statements.assign(setCookie, refreshCookie(nextToken.name, authCookieOptions))
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
    const cookieHeader = proc.in('p_cookie_header', 'VARCHAR2')
    const setCookie = proc.out('p_set_cookie', 'VARCHAR2')
    proc
      .body((statements) => {
        const presentedRefreshToken = statements.variable(
          'l_presented_refresh_token',
          'VARCHAR2',
          512,
        )
        statements.assign(
          presentedRefreshToken,
          `REGEXP_SUBSTR(${cookieHeader.name}, '(^|;[[:space:]]*)${authCookieOptions.refreshCookieName}=([^;]*)', 1, 1, NULL, 2)`,
        )
        statements.query(
          odbQuery()
            .updateTable(authSessions)
            .set({ revokedAt: new PlsqlExpression('TIMESTAMP', 'SYSTIMESTAMP') })
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
        statements.assign(setCookie, expiredRefreshCookie(authCookieOptions))
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
    const authorization = proc.in('p_authorization', 'VARCHAR2')
    const userId = proc.out('p_user_id', 'VARCHAR2')
    const username = proc.out('p_username', 'VARCHAR2')
    const displayName = proc.out('p_display_name', 'VARCHAR2')
    proc
      .body((statements) => {
        const subject = statements.variable('l_user_id', 'VARCHAR2', 32)
        statements.assign(subject, `odb_auth_jwt.require_user(${authorization.name})`)
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
          response: { userId, displayName },
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
      odbAuthApi.toSQLUp(options),
    ].join('\n')
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
          `MERGE INTO ${table} target USING (SELECT ${literal(user.username)} username FROM dual) source ON (LOWER(target.username) = LOWER(source.username)) WHEN MATCHED THEN UPDATE SET target.password_hash = ${crypto}.hash_password(${literal(user.password)}), target.display_name = ${literal(user.displayName ?? user.username)}, target.enabled = 1, target.token_version = target.token_version + 1, target.updated_at = SYSTIMESTAMP WHEN NOT MATCHED THEN INSERT (username, password_hash, display_name, enabled, token_version) VALUES (${literal(user.username)}, ${crypto}.hash_password(${literal(user.password)}), ${literal(user.displayName ?? user.username)}, 1, 0)`,
        )
      },
      toSQLDown() {
        return ''
      },
    }
  },
}
