import { describe, expect, it } from 'vitest'
import { odbAuth } from '../../../src/capabilities/auth/auth.js'
import { OrdsEndpoint } from '../../../src/ords.js'
import {
  compileApplicationEndpoints,
  defineService,
  odbPackage,
  odbType,
} from '../../../src/schema/package.js'
import { generateApplicationOpenApi } from '../../../src/application.js'

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
  it('stores normalized roles, grants and permissions with live validity and enabled-user checks', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP', jwtSecret: 'x'.repeat(32) })
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
    expect(odbAuth.role.has('l_id', 'p_role').toSQL()).toBe('odb_auth.has_role(l_id, p_role)')
    expect(odbAuth.perm.require('l_id', 'p_permission').toSQL()).toBe(
      'odb_auth.require_permission(l_id, p_permission)',
    )
    expect(
      odbAuth.role
        .seed({ name: 'admin', permissions: ['settings.read'] })
        .toSQLUp({ schema: 'APP' }),
    ).toContain("APP.odb_auth.grant_permission('admin', 'settings.read')")
    expect(
      odbAuth.role.seedGrant({ username: 'admin', role: 'admin' }).toSQLUp({ schema: 'APP' }),
    ).toContain("APP.odb_auth.grant_role(v_user_id, 'admin')")
  })
  it('emits tables and auth primitives without ORDS endpoints', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP', jwtSecret: 'x'.repeat(32) })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_users')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_crypto AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_jwt AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth AS')
    expect(sql).not.toContain('odb_http')
    expect(sql).toContain(
      "c_jwt_secret CONSTANT VARCHAR2(32767) := 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';",
    )
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
    expect(sql).toContain("l_subject := json_object_t.parse(l_payload).get_string('sub')")
    expect(sql).toContain("l_session_id := json_object_t.parse(l_payload).get_string('sid')")
    expect(sql).toContain("l_token_version := json_object_t.parse(l_payload).get_number('ver')")
  })

  it('implements HS256 access tokens in odb_auth_jwt without a separate JWT package', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP', jwtSecret: 'x'.repeat(32) })
    expect(sql).not.toContain('odb_jwt')
    expect(sql).toContain('FUNCTION base64url_encode(p_bytes IN RAW) RETURN VARCHAR2 IS')
    expect(sql).toContain(
      'DBMS_CRYPTO.MAC(UTL_RAW.CAST_TO_RAW(p_input), DBMS_CRYPTO.HMAC_SH256, UTL_RAW.CAST_TO_RAW(c_jwt_secret))',
    )
    expect(sql).toContain("l_signing_input := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' || '.'")
    expect(sql).toContain("'exp' VALUE l_now + 900")
    expect(sql).toContain(
      'IF sign(SUBSTR(p_token, 1, l_dot2 - 1)) != SUBSTR(p_token, l_dot2 + 1) THEN',
    )
    expect(sql).toContain('IF (l_expires_at IS NULL OR l_now > l_expires_at) THEN')
  })

  it('keeps odb_auth transport-independent', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP', jwtSecret: 'x'.repeat(32) })
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
    expect(sql).toContain("APP.odb_auth_crypto.hash_password('secret')")
  })
})
