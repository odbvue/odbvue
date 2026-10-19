import { describe, expect, it } from 'vitest'
import { odbAuth } from '../../../src/capabilities/auth/auth.js'
import { odbAuthPackage } from '../../../src/capabilities/auth/package.js'

function procedure(sql: string, name: string): string {
  const body = sql.indexOf('PACKAGE BODY APP.odb_auth AS')
  const start = sql.indexOf(
    sql.slice(body).match(new RegExp(`PROCEDURE ${name}\\([^\\n]*\\) IS`))![0],
    body,
  )
  return sql.slice(start, sql.indexOf(`END ${name};`, start))
}

describe('trusted Google identities', () => {
  it('defines authentication control flow without raw statement nodes', () => {
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return
      if ('kind' in node) expect(node.kind).not.toBe('raw')
      for (const value of Object.values(node)) visit(value)
    }
    visit(odbAuthPackage.application())
  })

  it('stores provider subjects separately and permits accounts without local passwords', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_identities')
    expect(sql).toContain(
      'CREATE UNIQUE INDEX APP.odb_auth_identities_uq ON APP.odb_auth_identities (issuer, subject)',
    )
    expect(sql).toContain(
      'FOREIGN KEY (user_id) REFERENCES APP.odb_auth_users (id) ON DELETE CASCADE',
    )
    const users = sql.slice(
      sql.indexOf('CREATE TABLE APP.odb_auth_users'),
      sql.indexOf('CREATE TABLE APP.odb_auth_identities'),
    )
    expect(users).not.toContain('password_hash')
    expect(users).toContain('(LOWER(TRIM(username)))')
    expect(sql).toContain('password_hash VARCHAR2(512 CHAR)')
    expect(sql).toContain("CASE WHEN issuer = 'password' THEN user_id END")
    expect(sql).toContain(
      "(issuer = 'password' AND password_hash IS NOT NULL) OR (issuer != 'password' AND password_hash IS NULL)",
    )
    const down = odbAuth.toSQLDown({ schema: 'APP' })
    expect(down.indexOf('DROP TABLE APP.odb_auth_identities')).toBeLessThan(
      down.indexOf('DROP TABLE APP.odb_auth_users'),
    )
  })

  it('resolves subject first and never merges or overwrites an existing account by email', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    const google = procedure(sql, 'login_google')
    expect(google).toContain("issuer = 'https://accounts.google.com'")
    expect(google).toContain('subject = p_subject')
    expect(google).toContain('LOWER(TRIM(username)) = l_address')
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
      expect(procedure(sql, name)).toContain('read_password_hash(l_user_id)')
    }
    expect(procedure(sql, 'login')).toContain('IF l_password_hash IS NULL THEN')
    expect(procedure(sql, 'login')).toContain('l_user_id := NULL')
    expect(procedure(sql, 'recover_password')).toContain(
      'IF read_password_hash(l_user_id) IS NULL THEN',
    )
    expect(procedure(sql, 'login')).toContain('c_dummy_password_hash')
    expect(procedure(sql, 'recover_password')).toMatch(/WHEN NO_DATA_FOUND THEN\s+RETURN;/)
    expect(procedure(sql, 'reset_password')).toContain('PASSWORD_RESET_INVALID')
  })

  it('creates and resets only local identities without putting credentials back on accounts', () => {
    const sql = odbAuth.toSQLUp()
    const signup = procedure(odbAuth.toSQLUp({ schema: 'APP' }), 'signup')
    expect(signup).toContain('INSERT INTO odb_auth_users (id, username, display_name, enabled)')
    expect(signup).toContain(
      'INSERT INTO odb_auth_identities (issuer, subject, user_id, password_hash)',
    )
    expect(signup).toContain(
      "'password', l_email, l_user_id, odb_auth_crypto.hash_password(p_password)",
    )
    expect(signup).toContain('l_password_hash IS NULL')
    expect(signup).toContain('ROLLBACK TO odb_password_signup')
    expect(sql).toContain(
      'UPDATE odb_auth_identities SET password_hash = odb_auth_crypto.hash_password(p_password)',
    )
    expect(sql).toContain("WHERE (user_id = l_user_id AND issuer = 'password')")
    expect(sql).not.toMatch(/UPDATE odb_auth_users SET password_hash/)
  })

  it('reauthenticates password users without creating or rotating a session', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    const start = procedure(sql, 'prepare_google_link')
    expect(start).toContain("odb_rate_limit.enforce('AUTH_GOOGLE_LINK_USER', p_user_id)")
    expect(start).toContain('l_password_hash IS NULL')
    expect(start).toContain('p_password IS NULL')
    expect(start).toContain('verify_password(p_password, l_password_hash) = FALSE')
    expect(start).toContain('GOOGLE_LINK_PASSWORD_INVALID')
    expect(start).not.toMatch(/open_session|INSERT INTO odb_auth_sessions|UPDATE odb_auth/)
    const session = procedure(sql, 'link_session')
    for (const guard of [
      'enabled = 1',
      'user_id = p_user_id',
      'refresh_token_hash = odb_auth_crypto.hash_token(p_refresh_token)',
      'revoked_at IS NULL',
      'expires_at > SYSTIMESTAMP',
      'FOR UPDATE',
    ])
      expect(session).toContain(guard)
    expect(session).not.toContain('previous_refresh_token_hash')
    const check = procedure(sql, 'check_google_link')
    for (const guard of [
      'p_session_id IS NULL',
      'p_token_version IS NULL',
      'p_session_id != l_current_session',
      'p_token_version != l_current_version',
    ])
      expect(check).toContain(guard)
  })

  it('links verified subjects idempotently and resolves unique-constraint races by owner', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP' })
    const link = procedure(sql, 'link_google')
    expect(link).toContain('GOOGLE_IDENTITY_INVALID')
    expect(link).toContain(
      'check_google_link(p_user_id, p_session_id, p_token_version, p_refresh_token)',
    )
    expect(link).toContain('INSERT INTO odb_auth_identities')
    expect(link).toContain("VALUES ('https://accounts.google.com', p_subject, p_user_id)")
    expect(link).toContain('WHEN DUP_VAL_ON_INDEX THEN')
    expect(link).toContain("issuer = 'https://accounts.google.com'")
    expect(link).toContain('subject = p_subject')
    expect(link).toContain('IF l_owner != p_user_id THEN')
    expect(link).toContain('GOOGLE_IDENTITY_EXISTS')
    expect(link).not.toMatch(/UPDATE |DELETE |open_session|login_google|grant_role|hash_password/)
    expect(link.indexOf('check_google_link(')).toBeLessThan(link.indexOf('INSERT INTO'))
  })
})
