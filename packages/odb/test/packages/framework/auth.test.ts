import { describe, expect, it } from 'vitest'
import { generateApplicationOpenApi } from '../../../src/application.js'
import { defineMigration } from '../../../src/migration.js'
import { odbAuth } from '../../../src/packages/framework/auth/auth.js'

describe('odbAuth framework package', () => {
  it('emits tables, primitives, and ORDS auth endpoints', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP', jwtSecret: 'x'.repeat(32) })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_users')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_crypto AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_jwt AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth AS')
    expect(sql).toContain("'pbkdf2-sha512$210000$' || l_salt || '$' || l_hash")
    expect(sql).toContain(
      "DBMS_CRYPTO.MAC(UTL_RAW.CONCAT(HEXTORAW(l_salt), HEXTORAW('00000001')), DBMS_CRYPTO.HMAC_SH512, l_password_raw)",
    )
    expect(sql).toContain('FOR l_round IN 2..210000 LOOP')
    expect(sql).toContain('l_password_raw RAW(2000)')
    expect(sql).toContain('l_derived_key RAW(64)')
    expect(sql).toContain("UTL_I18N.STRING_TO_RAW(p_password, 'AL32UTF8')")
    expect(sql).toContain("'^pbkdf2-sha512\\$([1-9][0-9]*)\\$'")
    expect(sql).not.toContain('DBMS_CRYPTO.PBKDF2')
    expect(sql).not.toContain('DBMS_CRYPTO.HASH(UTL_RAW.CAST_TO_RAW(l_salt ||')
    expect(sql).toContain(
      'PROCEDURE login(p_login_username IN odb_auth_users.username%TYPE, p_password IN VARCHAR2',
    )
    expect(sql).toContain('odb_auth_crypto.hash_token')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain("l_subject := odb_jwt.claim(l_token, 'sub')")
    expect(sql).toContain("l_session_id := odb_jwt.claim(l_token, 'sid')")
    expect(sql).toContain("l_token_version := TO_NUMBER(odb_jwt.claim(l_token, 'ver'))")
    expect(sql).toContain('FROM odb_auth_sessions s JOIN odb_auth_users u ON u.id = s.user_id')
    expect(sql).toContain('s.id = l_session_id')
    expect(sql).toContain('s.user_id = l_subject')
    expect(sql).toContain('s.revoked_at IS NULL')
    expect(sql).toContain('s.expires_at > SYSTIMESTAMP')
    expect(sql).toContain('u.enabled = 1')
    expect(sql).toContain('u.token_version = l_token_version')
  })

  it('registers the auth API with ORDS when installed by a migration', () => {
    const sql = defineMigration('auth', { schema: 'APP' })
      .install(odbAuth)
      .compile()
      .up()
      .join('\n')
    expect(sql).toContain("p_base_path      => 'auth/'")
    expect(sql).toContain("p_pattern        => 'login'")
    expect(sql).toContain("p_pattern        => 'refresh'")
    expect(sql).toContain("p_pattern        => 'me'")
  })

  it('publishes token-only login and refresh response contracts to OpenAPI', () => {
    const openapi = generateApplicationOpenApi(odbAuth.application()) as {
      components: { schemas: Record<string, { properties: Record<string, unknown> }> }
    }

    expect(openapi.components.schemas.OdbAuthLoginResponse.properties).toMatchObject({
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
    })
    expect(openapi.components.schemas.OdbAuthLoginResponse.properties).not.toHaveProperty('userId')
    expect(openapi.components.schemas.OdbAuthLoginResponse.properties).not.toHaveProperty(
      'username',
    )
  })

  it('seeds an idempotent default user through the crypto package', () => {
    const sql = odbAuth
      .seedUser({ username: 'admin', password: 'secret', displayName: 'Admin' })
      .toSQLUp({ schema: 'APP' })
    expect(sql).toContain('MERGE INTO APP.odb_auth_users')
    expect(sql).toContain("APP.odb_auth_crypto.hash_password('secret')")
  })
})
