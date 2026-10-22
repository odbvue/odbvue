import { describe, expect, it, vi } from 'vitest'
import { odbAuth } from '../../../src/capabilities/auth/auth.js'
import { odbLiteral } from '../../../src/schema/attribute.js'
import { OrdsEndpoint } from '../../../src/ords.js'
import {
  compileApplicationEndpoints,
  defineService,
  odbPackage,
  odbType,
} from '../../../src/schema/package.js'
import { generateApplicationOpenApi } from '../../../src/application.js'
import { authJwtSettings } from '../../../src/capabilities/auth/settings.js'
import { odbAuthJwt } from '../../../src/capabilities/auth/jwt.js'

describe('service authorization generation', () => {
  it('binds verified identity without a public request parameter and emits OpenAPI security', () => {
    const pkg = odbPackage('pck_app', (builder) => {
      const me = builder.proc('me', { in: { userId: odbType.string() } }, () => {})
      defineService(me, {
        method: 'GET',
        path: '/me',
        auth: 'authenticated',
        context: { userId: me.parameters.userId },
      })
      const login = builder.proc('login', {}, () => {})
      defineService(login, { method: 'POST', path: '/login', auth: 'anonymous' })
    })
    const document = generateApplicationOpenApi(pkg.application()) as any
    expect(document.paths['/app/me'].get.security).toEqual([{ bearerAuth: [] }])
    expect(document.paths['/app/me'].get.parameters).toEqual([])
    expect(document.paths['/app/login'].post.security).toEqual([])
    expect(compileApplicationEndpoints(pkg.application())[0].toNode().source).toContain(
      'p_user_id => v_auth_user_id',
    )
  })
  it('authenticates and checks live roles before calling the application', () => {
    const endpoint = new OrdsEndpoint('app', 'pck_app', 'settings').auth({ roles: ['admin'] })
    const source = endpoint.toNode().source
    expect(source).toContain(
      "odb_auth.require_user(REGEXP_SUBSTR(:odb_authorization, '^Bearer[[:space:]]+(.+)$'",
    )
    expect(source).toContain("odb_auth.has_role(v_auth_user_id, 'admin')")
    expect(source.indexOf('odb_auth.has_role')).toBeLessThan(source.indexOf('pck_app.settings('))
    expect(source).toContain('ODB_ERROR|FORBIDDEN|FORBIDDEN')
    expect(endpoint.toSQLUp()).toContain("p_name => 'Authorization'")
  })

  it('keeps anonymous handlers free of authentication plumbing', () => {
    const endpoint = new OrdsEndpoint('app', 'pck_app', 'login').auth('anonymous')
    expect(endpoint.toNode().source).not.toContain('odb_auth')
    expect(endpoint.toSQLUp()).not.toContain('odb_authorization')
  })

  it('rejects missing or ambiguous policies', () => {
    expect(() => new OrdsEndpoint('app', 'pck_app', 'settings').auth({} as never)).toThrow()
    expect(() =>
      new OrdsEndpoint('app', 'pck_app', 'settings').auth({ roles: [] } as never),
    ).toThrow()
  })

  it('supports all and any matching across roles and permissions with escaped names', () => {
    const endpoint = new OrdsEndpoint('app', 'pck_app', 'settings')
    expect(
      endpoint.auth({ roles: ['admin'], permissions: ["settings'write"] }).toNode().source,
    ).toContain(
      "odb_auth.has_role(v_auth_user_id, 'admin') AND odb_auth.has_permission(v_auth_user_id, 'settings''write')",
    )
    expect(endpoint.auth({ roles: ['admin', 'operator'], match: 'any' }).toNode().source).toContain(
      "odb_auth.has_role(v_auth_user_id, 'admin') OR odb_auth.has_role(v_auth_user_id, 'operator')",
    )
  })

  it('requires a policy at runtime and in the typed service contract', () => {
    expect(() =>
      odbPackage('pck_app', (builder) => {
        const proc = builder.proc('settings', {}, () => {})
        // @ts-expect-error Every service must make an authorization decision.
        defineService(proc, { method: 'GET', path: '/settings' })
      }),
    ).toThrow('Service auth requires')
  })

  it('rejects caller-controlled identity and authorization bindings', () => {
    expect(() =>
      odbPackage('pck_app', (builder) => {
        const proc = builder.proc('settings', { in: { userId: odbType.string() } }, () => {})
        defineService(proc, {
          method: 'GET',
          path: '/settings',
          auth: 'anonymous',
          context: { userId: proc.parameters.userId },
        })
      }),
    ).toThrow('context.userId')
    expect(() =>
      odbPackage('pck_app', (builder) => {
        const proc = builder.proc('settings', { in: { token: odbType.string() } }, () => {})
        defineService(proc, {
          method: 'GET',
          path: '/settings',
          auth: 'authenticated',
          headers: { Authorization: proc.parameters.token },
        })
      }),
    ).toThrow('Authorization is managed')
  })
})

describe('odbAuth framework package', () => {
  it('preserves the declared foreign keys in fresh installs', () => {
    const install = odbAuth.toSQLUp({ schema: 'APP' })
    const constraints = [
      'ALTER TABLE APP.odb_auth_user_roles ADD CONSTRAINT odb_auth_user_roles_fk_user FOREIGN KEY (user_id) REFERENCES APP.odb_auth_users (id) ON DELETE CASCADE',
      'ALTER TABLE APP.odb_auth_user_roles ADD CONSTRAINT odb_auth_user_roles_fk_role FOREIGN KEY (role) REFERENCES APP.odb_auth_roles (role) ON DELETE CASCADE',
      'ALTER TABLE APP.odb_auth_role_permissions ADD CONSTRAINT odb_auth_role_perms_fk_role FOREIGN KEY (role) REFERENCES APP.odb_auth_roles (role) ON DELETE CASCADE',
    ]
    for (const constraint of constraints) {
      expect(install.split(constraint)).toHaveLength(2)
    }
    expect(odbAuth).not.toHaveProperty('upgrade')
  })

  it('stores normalized roles, grants and permissions with live validity and enabled-user checks', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_roles')
    expect(sql).toContain('CREATE TABLE APP.odb_auth_user_roles')
    expect(sql).toContain('CREATE TABLE APP.odb_auth_role_permissions')
    expect(sql).toContain('PRIMARY KEY (user_id, role)')
    expect(sql).toContain('CHECK (valid_to > valid_from)')
    expect(sql).toContain('FOREIGN KEY (user_id) REFERENCES APP.odb_auth_users (id)')
    expect(sql).toContain('ur.valid_from <= SYSTIMESTAMP')
    expect(sql).toContain('ur.valid_to > SYSTIMESTAMP')
    expect(sql).toContain('u.enabled = 1')
    expect(sql).toContain('JOIN odb_auth_role_permissions rp ON rp.role = ur.role')
    expect(sql).toContain('JOIN odb_auth_users u ON u.id = ur.user_id')
    expect(sql).toContain('FUNCTION has_role(')
    expect(sql).toContain('FUNCTION has_permission(')
    expect(sql).toContain(
      'MERGE INTO odb_auth_roles target USING (SELECT p_role AS role FROM dual) source ON (target.role = source.role)',
    )
    expect(sql).toContain('ON ((target.user_id = source.userId AND target.role = source.role))')
    expect(sql).toContain(
      'ON ((target.role = source.role AND target.permission = source.permission))',
    )
    expect(sql).toContain('SELECT DISTINCT rp.permission')
    expect(sql).toContain('l_permission_array.append(permission_row.permission)')
    expect(sql).toContain('p_permissions := l_permission_array.to_clob();')
    expect(sql).not.toContain("p_permissions := 'l_permission_array.to_clob()';")
    expect(odbAuth.role.has('l_id', 'p_role').toSQL()).toBe('odb_auth.has_role(l_id, p_role)')
    expect(odbAuth.permission.require('l_id', 'p_permission').toSQL()).toBe(
      'odb_auth.require_permission(l_id, p_permission)',
    )
    expect(
      odbAuth.role
        .seed({ name: 'admin', permissions: ['settings.read'] })
        .toSQLUp({ schema: 'APP' }),
    ).toContain("APP.odb_auth.grant_permission('admin', 'settings.read')")
    expect(
      odbAuth.role.seedGrant({ username: 'admin', role: 'admin' }).toSQLUp({ schema: 'APP' }),
    ).toContain("APP.odb_auth.grant_role(l_user_id, 'admin', SYSTIMESTAMP, NULL)")
  })
  it('exposes permission helpers with unchanged SQL calls', () => {
    expect(odbAuth.permission.has('l_id', 'p_permission').toSQL()).toBe(
      'odb_auth.has_permission(l_id, p_permission)',
    )
    expect(odbAuth.permission.require('l_id', 'p_permission').toSQL()).toBe(
      'odb_auth.require_permission(l_id, p_permission)',
    )
    expect(odbAuth.permission.grant('p_role', 'p_permission').toSQL()).toBe(
      'odb_auth.grant_permission(p_role, p_permission)',
    )
    expect(odbAuth.permission.revoke('p_role', 'p_permission').toSQL()).toBe(
      'odb_auth.revoke_permission(p_role, p_permission)',
    )
    expect(odbAuth).not.toHaveProperty('perm')
  })

  it('emits tables and auth primitives without ORDS endpoints', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_users')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_crypto AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_jwt AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth AS')
    expect(sql).not.toContain('odb_http')
    expect(sql).not.toContain('c_jwt_secret')
    expect(sql).toContain("odb_settings.read('AUTH_JWT_SECRET', l_secret, l_meta)")
    expect(sql).not.toContain('__ODB_AUTH_')
    expect(sql).toContain("'pbkdf2-sha512$210000$' || l_salt || '$' || l_hash")
    expect(sql).toContain(
      "DBMS_CRYPTO.MAC(UTL_RAW.CONCAT(HEXTORAW(p_salt), HEXTORAW('00000001')), DBMS_CRYPTO.HMAC_SH512, p_password_raw)",
    )
    expect(sql).toContain('FOR l_round IN 2..p_iterations LOOP')
    expect(sql).toContain(
      'FUNCTION verify_password(p_password IN VARCHAR2, p_stored_hash IN VARCHAR2) RETURN BOOLEAN IS',
    )
    expect(sql).toContain('RETURN FALSE;')
    expect(sql).toContain('l_password_raw RAW(2000)')
    expect(sql).toContain('l_derived_key RAW(64)')
    expect(sql).toContain("UTL_I18N.STRING_TO_RAW(p_password, 'AL32UTF8')")
    expect(sql).toContain("'^pbkdf2-sha512\\$([1-9][0-9]*)\\$'")
    expect(sql).not.toContain('DBMS_CRYPTO.PBKDF2')
    expect(sql).not.toContain('DBMS_CRYPTO.HASH(UTL_RAW.CAST_TO_RAW(l_salt ||')
    expect(sql).toContain('previous_refresh_token_hash VARCHAR2(128 CHAR)')
    expect(sql).toContain("l_subject := l_claims.get_string('sub')")
    expect(sql).toContain("l_session_id := l_claims.get_string('sid')")
    expect(sql).toContain("l_token_version := l_claims.get_number('ver')")
  })

  it('implements HS256 access tokens in odb_auth_jwt without a separate JWT package', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    expect(sql).not.toContain('odb_jwt')
    expect(sql).toContain('FUNCTION base64url_encode(p_bytes IN RAW) RETURN VARCHAR2 IS')
    expect(sql).toContain(
      'DBMS_CRYPTO.MAC(UTL_RAW.CAST_TO_RAW(p_input), DBMS_CRYPTO.HMAC_SH256, UTL_RAW.CAST_TO_RAW(g_jwt_secret))',
    )
    expect(sql).toContain("l_signing_input := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' || '.'")
    expect(sql).toContain("'exp' VALUE l_now + g_jwt_expiration_seconds")
    expect(sql).toContain("'iss' VALUE g_jwt_issuer")
    expect(sql).toContain(
      'l_signature_matches := sign(SUBSTR(p_token, 1, l_dot2 - 1)) = SUBSTR(p_token, l_dot2 + 1);',
    )
    expect(sql).toContain('IF l_now >= l_expires_at THEN')
  })

  it('rejects empty JWT segments and requires a positively verified signature before decoding', () => {
    const sql = odbAuthJwt.toSQLUp({ schema: 'APP' })
    const start = sql.lastIndexOf('FUNCTION require_user(')
    const requireUser = sql.slice(start, sql.indexOf('END require_user;', start))
    for (const check of [
      'p_token IS NULL',
      'LENGTH(p_token) > 4000',
      'l_dot1 <= 1',
      'l_dot2 <= l_dot1 + 1',
      'l_dot2 >= LENGTH(p_token)',
      "INSTR(p_token, '.', 1, 3) != 0",
      "NOT (REGEXP_LIKE(p_token, '^[A-Za-z0-9_.-]+$', 'c'))",
      '(l_signature_matches IS NULL OR l_signature_matches = FALSE)',
    ]) {
      expect(requireUser).toContain(check)
      expect(requireUser.indexOf(check)).toBeLessThan(requireUser.indexOf('base64url_decode('))
    }
  })

  it('normalizes decoding, JSON, claim-type and bounded-assignment errors only', () => {
    const sql = odbAuthJwt.toSQLUp({ schema: 'APP' })
    const start = sql.lastIndexOf('FUNCTION require_user(')
    const requireUser = sql.slice(start, sql.indexOf('END require_user;', start))
    const parseStart = requireUser.lastIndexOf('BEGIN', requireUser.indexOf('l_encoded_payload :='))
    const handler = requireUser.indexOf('WHEN OTHERS THEN', parseStart)
    const parseEnd = requireUser.indexOf('END;', handler)
    const parse = requireUser.slice(parseStart, parseEnd)
    expect(parse).toContain('l_payload := base64url_decode(l_encoded_payload)')
    expect(parse).toContain('base64url_encode(UTL_RAW.CAST_TO_RAW(l_payload)) != l_encoded_payload')
    expect(parse).toContain('l_payload IS JSON STRICT WITH UNIQUE KEYS')
    expect(parse).toContain('l_claims := JSON_OBJECT_T.PARSE(l_payload)')
    expect(parse).toContain('l_claims.on_error(1)')
    for (const name of ['iss', 'sub', 'sid', 'exp', 'ver']) {
      expect(parse).toContain(`l_element := l_claims.get('${name}')`)
    }
    expect(parse.match(/l_element\.is_string\(\) = FALSE/g)).toHaveLength(3)
    expect(parse.match(/l_element\.is_number\(\) = FALSE/g)).toHaveLength(2)
    for (const variable of ['issuer', 'subject', 'session_id', 'expires_at', 'token_version']) {
      expect(parse).toContain(`l_${variable} IS NULL`)
    }
    expect(parse).toContain('l_expires_at != TRUNC(l_expires_at)')
    expect(parse).toContain('l_token_version != TRUNC(l_token_version)')
    expect(requireUser.slice(handler, parseEnd)).toMatch(
      /^WHEN OTHERS THEN\s+raise_application_error\(-\d+, 'ODB_ERROR\|UNAUTHORIZED\|UNAUTHORIZED'\);\s*$/,
    )
    expect(requireUser.indexOf('load_config();')).toBeLessThan(parseStart)
    expect(requireUser.indexOf('SELECT COUNT(*)')).toBeGreaterThan(parseEnd)
    expect(requireUser.slice(parseEnd)).not.toContain('WHEN OTHERS')
  })

  it('keeps odb_auth transport-independent', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    const pkg = sql.slice(sql.indexOf('CREATE OR REPLACE PACKAGE APP.odb_auth AS'))
    expect(pkg).toContain(
      'PROCEDURE login(p_username IN odb_auth_users.username%TYPE, p_password IN VARCHAR2, p_access_token OUT VARCHAR2, p_refresh_token OUT VARCHAR2);',
    )
    expect(pkg).toContain(
      'PROCEDURE refresh(p_refresh_token IN VARCHAR2, p_access_token OUT VARCHAR2, p_next_refresh_token OUT VARCHAR2);',
    )
    expect(pkg).toContain('PROCEDURE logout(p_refresh_token IN VARCHAR2);')
    expect(pkg).toContain('FUNCTION require_user(p_access_token IN VARCHAR2) RETURN VARCHAR2;')
    expect(pkg).toContain("'ODB_ERROR|UNAUTHORIZED|INVALID_CREDENTIALS'")
    expect(pkg).toContain("'ODB_ERROR|NOT_FOUND|NOT_FOUND'")
    for (const httpConcern of [
      'Set-Cookie',
      'Cookie',
      'Bearer',
      'Authorization',
      'odb_http',
      '__Host',
    ]) {
      expect(sql).not.toContain(httpConcern)
    }
    expect(sql).not.toContain('-20999')
  })

  it('exposes typed calls and shared types for application packages', () => {
    expect(odbAuth.login('p_u', 'p_p', 'l_a', 'l_r').toSQL()).toBe(
      'odb_auth.login(p_u, p_p, l_a, l_r)',
    )
    expect(odbAuth.refresh('p_r', 'l_a', 'l_n').toSQL()).toBe('odb_auth.refresh(p_r, l_a, l_n)')
    expect(odbAuth.logout('p_r').toSQL()).toBe('odb_auth.logout(p_r)')
    expect(odbAuth.readUser('l_id', 'p_u', 'p_d').toSQL()).toBe(
      'odb_auth.read_user(l_id, p_u, p_d)',
    )
    expect(odbAuth.requireUser('l_token').toSQL()).toBe('odb_auth.require_user(l_token)')
    const userId = odbAuth.requireUser(odbLiteral("token'value"))
    expect(userId.type).toBe('VARCHAR2')
    expect(userId.toSQL()).toBe("odb_auth.require_user('token''value')")
    expect(odbAuth.refreshTokenMaxAge).toBe(30 * 24 * 60 * 60)
    expect(Object.keys(odbAuth.types)).toEqual([
      'username',
      'password',
      'accessToken',
      'refreshToken',
      'userId',
      'displayName',
    ])
  })

  it('seeds an idempotent default user through the crypto package', () => {
    const sql = odbAuth
      .seedUser({ username: 'admin', password: 'secret', displayName: 'Admin' })
      .toSQLUp({ schema: 'APP' })
    expect(sql).toContain('MERGE INTO APP.odb_auth_users')
    expect(sql).toContain('l_user_id VARCHAR2(32)')
    expect(sql).not.toContain('%TYPE')
    const accountMerge = sql.slice(
      sql.indexOf('MERGE INTO APP.odb_auth_users'),
      sql.indexOf('SELECT id'),
    )
    expect(accountMerge).not.toContain('password_hash')
    expect(sql).toContain('MERGE INTO APP.odb_auth_identities')
    expect(sql).toContain("target.issuer = 'password'")
    expect(sql).toContain("APP.odb_auth_crypto.hash_password('secret')")
  })

  it('does not embed the retired JWT environment secret', () => {
    vi.stubEnv('ODBVUE_AUTH_JWT_SECRET', 'obsolete-signing-key-do-not-embed')
    try {
      const sql = odbAuth.toSQLUp()
      expect(sql).not.toContain('obsolete-signing-key')
      expect(sql).not.toContain('change-this-development-only')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('loads and caches a complete validated configuration before token operations', () => {
    const sql = odbAuthJwt.toSQLUp()
    const start = sql.indexOf('PROCEDURE load_config IS')
    const load = sql.slice(start, sql.indexOf('FUNCTION base64url_encode', start))
    expect(load.indexOf('SYSTIMESTAMP < g_config_expires_at')).toBeLessThan(
      load.indexOf('odb_settings.read'),
    )
    expect(load).toContain('RETURN;')
    expect(load).toContain("odb_settings.read('AUTH_JWT_ISSUER', l_issuer, l_meta)")
    expect(load).toContain("odb_settings.read('AUTH_JWT_EXPIRATION_SECONDS', l_expiration, l_meta)")
    expect(load).toContain("REGEXP_LIKE(l_secret, '^[0-9A-Fa-f]{64}$')")
    expect(load).toContain('TO_NUMBER(l_expiration) > 86400')
    expect(load).toContain("SYSTIMESTAMP + NUMTODSINTERVAL(30, 'SECOND')")
    expect(load.indexOf('AUTH_JWT_EXPIRATION_INVALID')).toBeLessThan(
      load.indexOf('g_jwt_secret := l_secret'),
    )
    expect(load).toMatch(/WHEN OTHERS THEN\s+g_config_expires_at := NULL;\s+g_jwt_secret := NULL;/)
    expect(load).toContain("odb_audit.error('Auth JWT: configuration loading failed')")
    expect(load).toContain('RAISE;')
    expect(sql.match(/load_config\(\);/g)).toHaveLength(2)
    expect(sql).toContain('IF l_issuer IS NULL THEN')
    expect(sql).toContain('IF l_issuer != g_jwt_issuer THEN')
    expect(sql).not.toContain('FROM odb_settings_store')
    expect(odbAuth.toSQLUp()).toContain('PROCEDURE load_config IS')
  })

  it('seeds only missing auth policy and JWT settings without key generation or destructive rollback', () => {
    const seed = odbAuth.seedSettings()
    const sql = seed.toSQLUp({ schema: 'APP' })
    expect(sql.match(/IF l_count = 0 THEN/g)).toHaveLength(7)
    expect(sql).toContain("FROM APP.odb_settings_store WHERE id = 'AUTH_JWT_SECRET'")
    expect(sql).toContain(
      `APP.odb_settings.write('AUTH_JWT_SECRET', '', '{"label":"JWT signing secret","type":"string","secret":"Y"}')`,
    )
    expect(sql).toContain("APP.odb_settings.write('AUTH_JWT_ISSUER', 'odbvue',")
    expect(sql).toContain("APP.odb_settings.write('AUTH_JWT_EXPIRATION_SECONDS', '900',")
    expect(sql).not.toContain('RANDOMBYTES')
    expect(seed.toSQLDown()).toBe('')
  })
})

describe('JWT configuration validation', () => {
  it.each(['00'.repeat(32), 'aF'.repeat(32)])(
    'accepts exactly 32 bytes of hexadecimal key material',
    (secret) => {
      expect(authJwtSettings.secretValid(secret)).toBe(true)
    },
  )
  it.each([
    undefined,
    null,
    '',
    'a'.repeat(63),
    'a'.repeat(65),
    'g'.repeat(64),
    'a'.repeat(64) + '\n',
    'change-this-development-only-odbvue-auth-secret-2026',
  ])('rejects malformed key material', (secret) => {
    expect(authJwtSettings.secretValid(secret)).toBe(false)
  })
  it.each([1, 900, 86400])('accepts expiration boundary %i', (seconds) => {
    expect(authJwtSettings.expirationValid(seconds)).toBe(true)
  })
  it.each([0, -1, 86401, 1.5, '900', NaN, Infinity, null])(
    'rejects invalid expiration %s',
    (seconds) => {
      expect(authJwtSettings.expirationValid(seconds)).toBe(false)
    },
  )
  it.each(['odbvue', 'https://auth.example.com', 'a'.repeat(255)])(
    'accepts a valid issuer',
    (issuer) => {
      expect(authJwtSettings.issuerValid(issuer)).toBe(true)
    },
  )
  it.each(['', ' ', ' issuer', 'issuer\n', 'a'.repeat(256), null])(
    'rejects an invalid issuer',
    (issuer) => {
      expect(authJwtSettings.issuerValid(issuer)).toBe(false)
    },
  )
})
