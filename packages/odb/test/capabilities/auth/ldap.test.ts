import { describe, expect, it } from 'vitest'
import { odbAuth } from '../../../src/capabilities/auth/auth.js'
import { authLdapSettings } from '../../../src/capabilities/auth/settings.js'

const sql = odbAuth.toSQLUp({ schema: 'APP' })
function procedure(name: string) {
  const start = sql.lastIndexOf(`PROCEDURE ${name}(`)
  return sql.slice(start, sql.indexOf(`END ${name};`, start))
}
const ldap = procedure('verify_ldap_credentials')
const verify = procedure('verify_credentials')

describe('LDAP and LDAPS authentication', () => {
  it('seeds disabled, missing-only configuration with encrypted password placeholders', () => {
    const seed = odbAuth.seedSettings().toSQLUp({ schema: 'APP' })
    expect(seed).toContain("APP.odb_settings.write('AUTH_LDAP_ENABLED', 'N'")
    expect(seed).toContain("APP.odb_settings.write('AUTH_LDAP_TLS_ENABLED', 'N'")
    expect(seed).toContain("APP.odb_settings.write('AUTH_LDAP_PORT', '389'")
    for (const setting of authLdapSettings) {
      expect(seed).toContain(`FROM APP.odb_settings_store WHERE id = '${setting.id}'`)
      expect(seed).toContain(`APP.odb_settings.write('${setting.id}', '${setting.value}'`)
      if ('secret' in setting)
        expect(seed).toContain(
          `'${setting.id}', '', '{"label":"${setting.label}","type":"string","secret":"Y"}'`,
        )
    }
    expect(() => odbAuth.config({ ldap: 'Y' } as never)).toThrow('must be a boolean')
  })

  it('opens verified TLS only when enabled, before any bind and without plaintext fallback', () => {
    const tlsStart = ldap.indexOf("IF l_tls_enabled = 'Y' THEN")
    const firstBind = ldap.indexOf('l_status := DBMS_LDAP.simple_bind_s')
    expect(tlsStart).toBeGreaterThan(-1)
    expect(firstBind).toBeGreaterThan(tlsStart)
    const tlsBranch = ldap.slice(tlsStart, firstBind)
    expect(tlsBranch).toContain('DBMS_LDAP.open_ssl')
    expect(tlsBranch).toContain("raise_application_error(-20001, 'LDAP_DIRECTORY_FAILURE')")
    expect(tlsBranch.trim().endsWith('END IF;')).toBe(true)
    expect(tlsBranch).not.toContain('ELSE')
    expect(ldap.match(/DBMS_LDAP.open_ssl/g)).toHaveLength(1)
    expect(ldap).toContain('DBMS_LDAP.open_ssl(l_session, l_wallet_path, l_wallet_password, 2)')
    expect(ldap.indexOf('DBMS_LDAP.open_ssl')).toBeLessThan(ldap.indexOf('DBMS_LDAP.simple_bind_s'))
    expect(ldap).toContain('DBMS_LDAP.simple_bind_s(l_session, l_bind_dn, l_bind_password)')
    expect(ldap).toContain('DBMS_LDAP.simple_bind_s(l_session, l_dn, p_password)')
    expect(ldap).not.toContain('sslauth => 1')
    expect(ldap).toContain("'^file:.+'")
    expect(ldap).toContain('l_timeout.seconds := 10')
    expect(ldap).toContain('DBMS_LDAP.search_st(')
  })

  it('loads and validates the explicit transport setting before any connection', () => {
    const read = ldap.indexOf("odb_settings.read('AUTH_LDAP_TLS_ENABLED', l_value, l_meta)")
    expect(read).toBeGreaterThan(-1)
    expect(read).toBeLessThan(ldap.indexOf('DBMS_LDAP.init'))
    expect(ldap).toContain("l_tls_enabled != 'Y' AND l_tls_enabled != 'N'")
    expect(ldap.slice(read, ldap.indexOf('l_tls_enabled := l_value;', read))).toContain(
      'l_value IS NULL OR LENGTH(l_value) > 1',
    )
  })

  it('escapes every RFC4515 metacharacter and validates attribute, host and port', () => {
    for (const escape of ['5c', '2a', '28', '29', '00']) expect(ldap).toContain(`'\\${escape}'`)
    expect(ldap).toContain('CHR(0)')
    expect(ldap).toContain("'^[A-Za-z][A-Za-z0-9-]*$'")
    expect(ldap).toContain('TO_NUMBER(l_port) < 1 OR TO_NUMBER(l_port) > 65535')
    expect(ldap).toContain('LDAP_CONFIG_INVALID')
    expect(verify).toContain('p_password IS NULL')
    expect(verify).toContain('LENGTH(p_username) > 128')
  })

  it('allows database-managed trust with null wallet settings while retaining verified TLS', () => {
    for (const [setting, variable] of [
      ['AUTH_LDAP_WALLET_PATH', 'l_wallet_path'],
      ['AUTH_LDAP_WALLET_PASSWORD', 'l_wallet_password'],
    ]) {
      const start = ldap.indexOf(`odb_settings.read('${setting}'`)
      const end = ldap.indexOf(`${variable} := l_value;`, start)
      expect(start).toBeGreaterThan(-1)
      expect(end).toBeGreaterThan(start)
      expect(ldap.slice(start, end)).not.toContain('l_value IS NULL')
      expect(ldap.slice(start, end)).toContain('LENGTH(l_value) > 2000')
    }
    expect(ldap).toContain(
      "l_wallet_path IS NOT NULL AND NOT (REGEXP_LIKE(l_wallet_path, '^file:.+'))",
    )
    expect(ldap).toContain('DBMS_LDAP.open_ssl(l_session, l_wallet_path, l_wallet_password, 2)')
  })

  it('falls back only for zero results, never bad credentials, ambiguity or directory failure', () => {
    expect(ldap).toContain('p_subject := NULL')
    expect(ldap).toContain('l_count < 0 OR l_count > 1')
    expect(ldap).toContain('LDAP_SEARCH_AMBIGUOUS')
    expect(ldap).toContain('IF l_count = 1 THEN')
    expect(ldap).toContain('IF l_status = 49 THEN')
    expect(ldap).toContain('INVALID_CREDENTIALS')
    expect(ldap).toContain("raise_application_error(-20001, 'LDAP_DIRECTORY_FAILURE')")
    expect(verify.indexOf("enabled('ldap')")).toBeLessThan(verify.indexOf("enabled('password')"))
    expect(verify).toContain('IF l_ldap_subject IS NOT NULL THEN')
    expect(verify.indexOf('RETURN;')).toBeLessThan(verify.indexOf("enabled('password')"))
  })

  it('creates separate identities, rejects collisions, checks signup and locks enabled accounts', () => {
    expect(verify).toContain("issuer = 'ldap' AND subject = l_ldap_subject")
    expect(verify).toContain('LDAP_USERNAME_EXISTS')
    expect(verify).toContain("enabled('signup')")
    expect(verify).toContain('INSERT INTO odb_auth_identities')
    expect(verify).toContain("'ldap', l_ldap_subject, p_user_id")
    expect(verify).toContain(
      'SELECT enabled INTO l_enabled FROM odb_auth_users WHERE id = p_user_id FOR UPDATE',
    )
    expect(verify).toContain('IF l_enabled != 1 THEN')
    expect(verify).not.toContain('hash_password(p_password)')
    expect(procedure('begin_login')).toContain(
      'verify_credentials(p_username, p_password, l_user_id)',
    )
    expect(procedure('begin_login')).toContain("enabled('twoFactor')")
  })

  it('rate-limits before directory access and restores pooled state and resources on errors', () => {
    expect(verify.indexOf("odb_rate_limit.failure('AUTH_LOGIN_USERNAME'")).toBeLessThan(
      verify.indexOf('verify_ldap_credentials('),
    )
    expect(ldap).toContain('DBMS_LDAP.msgfree(l_result)')
    expect(ldap).toContain('DBMS_LDAP.unbind_s(l_session)')
    expect(ldap.match(/DBMS_LDAP.use_exception := l_previous_exceptions/g)).toHaveLength(2)
    expect(ldap).toContain("odb_audit.error('LDAP_AUTHENTICATION_FAILURE')")
    expect(ldap).toContain('RAISE;')
    for (const name of ['login', 'begin_login'])
      expect(procedure(name)).toContain('ROLLBACK TO odb_auth_')
  })

  it('uses PL/SQL-compatible VARCHAR2 JSON for inline audit attributes', () => {
    expect(ldap.match(/JSON_OBJECT\('status' VALUE l_status RETURNING VARCHAR2\)/g)).toHaveLength(6)
    expect(ldap).not.toContain("JSON_OBJECT('status' VALUE l_status RETURNING CLOB)")
  })
})
