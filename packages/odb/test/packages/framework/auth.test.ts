import { describe, expect, it } from 'vitest'
import { odbAuth } from '../../../src/capabilities/auth/auth.js'

describe('odbAuth framework package', () => {
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
