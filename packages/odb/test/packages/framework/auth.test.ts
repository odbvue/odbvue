import { describe, expect, it } from 'vitest'
import { odbAuth } from '../../../src/capabilities/auth/auth.js'

describe('odbAuth framework package', () => {
  it('reads provider status from identities and prefers uploaded avatars over Google photos', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    expect(sql).toContain('avatar CHAR(32 CHAR)')
    expect(sql).toContain('google_avatar_url VARCHAR2(2048')
    expect(sql).toContain(
      'SELECT google_avatar_url, CASE WHEN avatar IS NULL THEN 0 ELSE 1 END, avatar',
    )
    expect(sql).toContain('REFERENCES APP.odb_storage_files (id) ON DELETE SET NULL')
    expect(sql).toContain("COUNT(CASE WHEN issuer = 'password' THEN 1 ELSE NULL END)")
    expect(sql).toContain(
      "COUNT(CASE WHEN issuer = 'https://accounts.google.com' THEN 1 ELSE NULL END)",
    )
    expect(sql).toContain('DBMS_LOB.GETLENGTH(p_avatar) > 30000')
    expect(sql).toContain('DBMS_LOB.GETLENGTH(p_avatar) < 31')
    expect(sql).toContain('^data:image/jpeg;base64,/9j/')
    expect(sql).toContain('PROFILE_AVATAR_INVALID')
    expect(sql).toContain('odb_lob.base64_to_blob(DBMS_LOB.SUBSTR(p_avatar, 30000, 24))')
    expect(sql).toContain("RAWTOHEX(DBMS_LOB.SUBSTR(l_content, 3, 1)) != 'FFD8FF'")
    expect(sql).toContain("odb_storage.write(p_user_id, 'avatar.jpg', 'image/jpeg', l_content")
    const start = sql.indexOf(
      'PROCEDURE update_avatar(',
      sql.indexOf('PACKAGE BODY APP.odb_auth AS'),
    )
    const update = sql.slice(start, sql.indexOf('END update_avatar;', start))
    expect(update.indexOf('FOR UPDATE')).toBeLessThan(update.indexOf('odb_storage.write'))
    expect(update.indexOf('avatar = l_avatar_id')).toBeLessThan(
      update.indexOf('odb_storage.remove'),
    )
    expect(update).toContain('odb_storage.remove(p_user_id, l_previous_avatar)')
    expect(update).not.toContain('COMMIT')
  })

  it('locks the account before checking current password and revokes tokens, sessions and reset links atomically', () => {
    const sql = odbAuth.toSQLUp()
    const start = sql.indexOf('PROCEDURE change_password(', sql.indexOf('PACKAGE BODY'))
    const change = sql.slice(start, sql.indexOf('END change_password;', start))
    expect(change.indexOf('FOR UPDATE')).toBeLessThan(change.indexOf('verify_password'))
    expect(change).toContain('verify_password(p_current_password, l_password_hash)')
    expect(change).toContain('LENGTH(p_password) < 8')
    expect(change).toContain('LENGTH(p_password) > 256')
    expect(change).toContain('PASSWORD_NOT_CONNECTED')
    expect(change).toContain('PASSWORD_CHANGE_CURRENT_INVALID')
    expect(change).toContain("odb_rate_limit.enforce('AUTH_PASSWORD_CHANGE_USER', p_user_id)")
    expect(change).toContain('password_hash = odb_auth_crypto.hash_password(p_password)')
    expect(change).toContain('token_version = token_version + 1')
    expect(change).toContain('UPDATE odb_auth_sessions SET revoked_at = SYSTIMESTAMP')
    expect(change).toContain('DELETE FROM odb_auth_password_resets WHERE user_id = p_user_id')
    expect(change).not.toContain('COMMIT')
  })

  it('isolates hashed one-hour recovery tokens and installs/drops their table', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_password_resets')
    expect(sql).toContain(
      'odb_auth_pw_resets_fk_user FOREIGN KEY (user_id) REFERENCES APP.odb_auth_users (id) ON DELETE CASCADE',
    )
    const down = odbAuth.toSQLDown({ schema: 'APP' })
    expect(down.indexOf('DROP TABLE APP.odb_auth_password_resets')).toBeLessThan(
      down.indexOf('DROP TABLE APP.odb_auth_users'),
    )
    const start = sql.indexOf(
      'PROCEDURE recover_password(',
      sql.indexOf('PACKAGE BODY APP.odb_auth AS'),
    )
    const recovery = sql.slice(start, sql.indexOf('PROCEDURE reset_password(', start))
    expect(recovery).toContain('p_reset_token := NULL')
    expect(recovery).toContain('l_email := LOWER(TRIM(p_username))')
    expect(recovery).toContain('enabled = 1')
    expect(recovery).toContain('FOR UPDATE')
    expect(recovery).toMatch(/WHEN NO_DATA_FOUND THEN\s+RETURN;/)
    expect(recovery).toContain('MERGE INTO odb_auth_password_resets')
    expect(recovery).toContain('p_reset_token := odb_auth_crypto.random_token(32)')
    expect(recovery).toContain('odb_auth_crypto.hash_token(p_reset_token)')
    expect(recovery).toContain("NUMTODSINTERVAL(3600, 'SECOND')")
    expect(recovery).not.toContain('UPDATE odb_auth_users')
    expect(recovery).not.toContain('odb_auth_confirmations')
    expect(recovery).toContain("odb_rate_limit.failure('AUTH_RECOVERY_EMAIL', l_email)")
    expect(odbAuth.password.recover('p_email', 'l_token').toSQL()).toBe(
      'odb_auth.recover_password(p_email, l_token)',
    )
  })

  it('rechecks reset tokens under the account lock and atomically changes password and revokes sessions', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    const start = sql.indexOf(
      'PROCEDURE reset_password(',
      sql.indexOf('PACKAGE BODY APP.odb_auth AS'),
    )
    const reset = sql.slice(start, sql.indexOf('END reset_password;', start))
    expect(reset).toContain("REGEXP_LIKE(p_token, '^[A-F0-9]{64}$')")
    expect(reset).toContain('LENGTH(p_password) < 8')
    expect(reset).toContain('LENGTH(p_password) > 256')
    expect(reset.match(/FROM odb_auth_password_resets/g)).toHaveLength(3)
    expect(reset).toContain('expires_at > CAST(SYSTIMESTAMP AS TIMESTAMP)')
    expect(reset).toContain('enabled = 1')
    const lock = reset.indexOf('FROM odb_auth_users')
    expect(lock).toBeGreaterThan(reset.indexOf('FROM odb_auth_password_resets'))
    expect(lock).toBeLessThan(reset.lastIndexOf('SELECT user_id'))
    expect(reset).toContain('password_hash = odb_auth_crypto.hash_password(p_password)')
    expect(reset).toContain('token_version = token_version + 1')
    expect(reset).toContain('UPDATE odb_auth_sessions SET revoked_at = SYSTIMESTAMP')
    expect(reset).toContain('DELETE FROM odb_auth_password_resets WHERE user_id = l_user_id')
    expect(reset).toContain("odb_rate_limit.success('AUTH_LOGIN_USERNAME', LOWER(l_email))")
    expect(reset).toContain('ODB_ERROR|VALIDATION_ERROR|PASSWORD_RESET_INVALID')
    expect(reset).not.toContain('COMMIT')
    expect(reset).not.toContain('enabled = 1,')
    expect(reset).not.toContain('create_access_token')
    const login = sql.slice(
      sql.lastIndexOf('PROCEDURE verify_credentials('),
      sql.indexOf('END verify_credentials;', sql.lastIndexOf('PROCEDURE verify_credentials(')),
    )
    expect(login).toContain('FOR UPDATE')
    expect(login.indexOf('FOR UPDATE')).toBeLessThan(login.indexOf('verify_password'))
    expect(login).toMatch(/WHEN NO_DATA_FOUND THEN\s+l_password_hash := c_dummy_password_hash;/)
    expect(odbAuth.password.reset('p_token', 'p_password').toSQL()).toBe(
      'odb_auth.reset_password(p_token, p_password)',
    )
  })

  it('creates inactive accounts with hashed single-use confirmation tokens and password-protected retries', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_confirmations')
    expect(sql).toContain(
      'FOREIGN KEY (user_id) REFERENCES APP.odb_auth_users (id) ON DELETE CASCADE',
    )
    expect(sql).toContain('ODB_ERROR|VALIDATION_ERROR|SIGNUP_PASSWORD_INVALID')
    expect(sql).toContain('ODB_ERROR|CONFLICT|SIGNUP_EMAIL_EXISTS')
    expect(sql).toContain('odb_auth_crypto.verify_password(p_password, l_password_hash)')
    expect(sql).toContain('odb_auth_crypto.hash_password(p_password)')
    expect(sql).toContain('l_email := LOWER(TRIM(p_username))')
    expect(sql).toContain('p_confirmation_token := odb_auth_crypto.random_token(32)')
    expect(sql).toContain('odb_auth_crypto.hash_token(p_confirmation_token)')
    expect(sql).toContain("SYSTIMESTAMP + NUMTODSINTERVAL(1, 'DAY')")
    expect(sql).toContain('l_enabled = 1')
    expect(sql).not.toContain('l_enabled = TRUE')
    expect(sql).toContain('TRIM(p_display_name), 0)')
    expect(sql).toContain('expires_at > CAST(SYSTIMESTAMP AS TIMESTAMP)')
    expect(sql).toContain('DELETE FROM odb_auth_confirmations')
    expect(sql).toContain('ODB_ERROR|VALIDATION_ERROR|CONFIRMATION_INVALID')
    expect(odbAuth.signup('p_email', 'p_password', 'p_name', 'l_token').toSQL()).toBe(
      'odb_auth.signup(p_email, p_password, p_name, l_token)',
    )
    expect(odbAuth.confirmSignup('p_token').toSQL()).toBe('odb_auth.confirm_email(p_token)')
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
    expect(sql).toContain(
      'l_signature_matches := sign(SUBSTR(p_token, 1, l_dot2 - 1)) = SUBSTR(p_token, l_dot2 + 1);',
    )
    expect(sql).toContain('IF (l_signature_matches IS NULL OR l_signature_matches = FALSE) THEN')
    expect(sql).toContain('IF l_now >= l_expires_at THEN')
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
