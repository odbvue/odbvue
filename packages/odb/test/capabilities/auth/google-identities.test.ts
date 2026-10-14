import { describe, expect, it } from 'vitest'
import { odbAuth } from '../../../src/capabilities/auth/auth.js'

function procedure(sql: string, name: string): string {
  const body = sql.indexOf('PACKAGE BODY APP.odb_auth AS')
  const start = sql.indexOf(`PROCEDURE ${name}(`, body)
  return sql.slice(start, sql.indexOf(`END ${name};`, start))
}

describe('trusted Google identities', () => {
  it('stores provider subjects separately and permits accounts without local passwords', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_identities')
    expect(sql).toContain(
      'CREATE UNIQUE INDEX APP.odb_auth_identities_uq ON APP.odb_auth_identities (issuer, subject)',
    )
    expect(sql).toContain(
      'FOREIGN KEY (user_id) REFERENCES APP.odb_auth_users (id) ON DELETE CASCADE',
    )
    expect(sql).not.toContain('password_hash VARCHAR2(512 CHAR) NOT NULL')
    const down = odbAuth.toSQLDown({ schema: 'APP' })
    expect(down.indexOf('DROP TABLE APP.odb_auth_identities')).toBeLessThan(
      down.indexOf('DROP TABLE APP.odb_auth_users'),
    )
    const upgrade = odbAuth.upgrade().toSQLUp({ schema: 'APP' })
    expect(upgrade).toContain('ALTER TABLE APP.odb_auth_users MODIFY (password_hash NULL)')
    expect(upgrade).toContain("IF l_nullable = 'N' THEN")
    expect(upgrade).toContain("EXECUTE IMMEDIATE 'CREATE TABLE APP.odb_auth_identities")
  })

  it('resolves subject first and never merges or overwrites an existing account by email', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    const google = procedure(sql, 'login_google')
    expect(google).toContain("issuer = 'https://accounts.google.com'")
    expect(google).toContain('subject = p_subject')
    expect(google).toContain('LOWER(username) = l_address')
    expect(google).toContain('GOOGLE_EMAIL_EXISTS')
    expect(google.indexOf('GOOGLE_EMAIL_EXISTS')).toBeLessThan(
      google.indexOf('INSERT INTO odb_auth_users'),
    )
    expect(google).not.toContain('UPDATE odb_auth_users')
    expect(google).not.toContain('hash_password')
    expect(google).not.toContain('grant_role')
    expect(google).toContain('ROLLBACK TO odb_google_login')
    expect(odbAuth.loginGoogle('p_sub', 'p_email', 'p_name', 'l_access', 'l_refresh').toSQL()).toBe(
      'odb_auth.login_google(p_sub, p_email, p_name, l_access, l_refresh)',
    )
  })

  it('shares session creation and checks enabled status under lock for both authentication methods', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    const open = procedure(sql, 'open_session')
    expect(open).toContain('enabled = 1')
    expect(open).toContain('FOR UPDATE')
    expect(open).not.toContain('password_hash')
    expect(open).toContain('odb_auth_crypto.hash_token(l_new_refresh_token)')
    expect(open).toContain(
      'odb_auth_jwt.create_access_token(p_user_id, l_session_id, l_token_version)',
    )
    expect(procedure(sql, 'login')).toContain(
      'open_session(l_user_id, p_access_token, p_refresh_token)',
    )
    expect(procedure(sql, 'login_google')).toContain(
      'open_session(l_user_id, p_access_token, p_refresh_token)',
    )
  })

  it('does not enable password login or recovery/reset for Google-only accounts', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    for (const name of ['login', 'recover_password', 'reset_password']) {
      expect(procedure(sql, name)).toContain('password_hash IS NOT NULL')
    }
    expect(procedure(sql, 'login')).toContain('c_dummy_password_hash')
    expect(procedure(sql, 'recover_password')).toMatch(/WHEN NO_DATA_FOUND THEN\s+RETURN;/)
    expect(procedure(sql, 'reset_password')).toContain('PASSWORD_RESET_INVALID')
  })
})
