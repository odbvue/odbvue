import { describe, expect, it } from 'vitest'
import { odbAuth } from '../../../src/packages/framework/auth/auth.js'

describe('odbAuth framework package', () => {
  it('emits tables and auth primitives without ORDS endpoints', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP', jwtSecret: 'x'.repeat(32) })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_users')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_crypto AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_jwt AS')
    expect(sql).not.toContain('CREATE OR REPLACE PACKAGE APP.odb_auth AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_http AS')
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
    expect(sql).toContain("l_subject := odb_jwt.claim(l_token, 'sub')")
    expect(sql).toContain("l_session_id := odb_jwt.claim(l_token, 'sid')")
    expect(sql).toContain("l_token_version := TO_NUMBER(odb_jwt.claim(l_token, 'ver'))")
  })

  it('seeds an idempotent default user through the crypto package', () => {
    const sql = odbAuth
      .seedUser({ username: 'admin', password: 'secret', displayName: 'Admin' })
      .toSQLUp({ schema: 'APP' })
    expect(sql).toContain('MERGE INTO APP.odb_auth_users')
    expect(sql).toContain("APP.odb_auth_crypto.hash_password('secret')")
  })
})
