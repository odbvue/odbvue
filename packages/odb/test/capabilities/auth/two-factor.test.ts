import { describe, expect, it } from 'vitest'
import { odbAuth } from '../../../src/capabilities/auth/auth.js'
import { odbAuthCrypto } from '../../../src/capabilities/auth/core/crypto.js'

const sql = odbAuth.toSQLUp({ schema: 'APP' })
function procedure(name: string) {
  const start = sql.lastIndexOf(`PROCEDURE ${name}(`)
  return sql.slice(start, sql.indexOf(`END ${name};`, start))
}

describe('auth policy and two-factor SQL', () => {
  it('generates cryptographic helpers without raw statement nodes', () => {
    expect(JSON.stringify(odbAuthCrypto.application())).not.toContain('"kind":"raw"')
    const crypto = odbAuthCrypto.toSQLUp()
    expect(crypto).toContain("l_offset := TO_NUMBER(SUBSTR(l_digest, -1), 'X') * 2 + 1;")
    expect(crypto).toContain(
      "l_binary := BITAND(TO_NUMBER(SUBSTR(l_digest, l_offset, 8), 'XXXXXXXX'), 2147483647);",
    )
    expect(crypto).toContain(
      "l_block := TO_NUMBER(SUBSTR(p_secret, l_chunk * 10 + 1, 10), 'XXXXXXXXXX');",
    )
    expect(crypto).toContain(
      "l_result := l_result || SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', MOD(TRUNC(l_block / POWER(2, 35 - l_symbol * 5)), 32) + 1, 1);",
    )
    expect(crypto).toContain(
      "l_counter := FLOOR((CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE) - DATE '1970-01-01') * 86400 / 30);",
    )
  })

  it('defaults LDAP off and other policy flags on, and permits deployment overrides', () => {
    const defaults = odbAuth.config().toSQLUp({ schema: 'APP' })
    for (const name of ['PASSWORD', 'TWO_FACTOR', 'GOOGLE', 'SIGNUP'])
      expect(defaults).toContain(`APP.odb_settings.write('AUTH_${name}_ENABLED', 'Y'`)
    const overrides = odbAuth
      .config({ password: false, twoFactor: false, google: false, signup: false })
      .toSQLUp()
    expect(overrides.match(/_ENABLED', 'N'/g)).toHaveLength(5)
    expect(defaults).toContain("AUTH_LDAP_ENABLED', 'N'")
    expect(odbAuth.config({ ldap: true }).toSQLUp()).toContain("AUTH_LDAP_ENABLED', 'Y'")
    expect(() => odbAuth.config({ password: 'true' } as never)).toThrow('must be a boolean')
    expect(odbAuth.enabled('twoFactor').toSQL()).toBe("odb_auth.enabled('twoFactor')")
    expect(sql).toContain('AUTH_CONFIG_INVALID')
    expect(sql).toContain('AUTH_FEATURE_INVALID')
  })

  it('installs cascading factor, challenge, and hashed recovery tables', () => {
    for (const name of ['factors', 'challenges', 'recovery_codes']) {
      expect(sql).toContain(`CREATE TABLE APP.odb_auth_${name}`)
      expect(odbAuth.toSQLDown({ schema: 'APP' })).toContain(`DROP TABLE APP.odb_auth_${name}`)
    }
    expect(sql).toContain('odb_auth_challenges_uq_user')
    expect(sql).toContain('secret CLOB NOT NULL')
    expect(sql).toContain('PRIMARY KEY (user_id, code_hash)')
    expect(sql).toContain("UTL_I18N.STRING_TO_RAW('odb-settings:v1:'")
    expect(sql).toContain("'odb-auth-totp:' || l_user_id")
  })

  it('prevents bypassing two-factor through the legacy login entry point', () => {
    const login = procedure('login')
    expect(login.indexOf("enabled('twoFactor')")).toBeLessThan(login.indexOf('verify_credentials('))
    expect(login).toContain('TWO_FACTOR_REQUIRED')
    expect(procedure('verify_credentials')).toContain('PASSWORD_DISABLED')
    expect(procedure('signup')).toContain('SIGNUP_DISABLED')
    expect(procedure('login_google')).toContain('GOOGLE_DISABLED')
  })

  it('returns a five-minute restricted challenge and encrypted pending enrollment without a session', () => {
    const begin = procedure('begin_login')
    expect(begin.indexOf('verify_credentials(')).toBeLessThan(begin.indexOf('random_token('))
    expect(begin).toContain("IF enabled('twoFactor') = FALSE THEN")
    expect(begin).toMatch(/open_session\([^;]+;\s+RETURN;/)
    expect(begin.match(/open_session\(/g)).toHaveLength(1)
    expect(begin).toContain("odb_rate_limit.enforce('AUTH_2FA_START_USER', l_user_id)")
    expect(begin).toContain('odb_auth_crypto.random_token(20)')
    expect(begin).toContain('encrypt_value(')
    expect(begin).toContain('odb_auth_crypto.hash_token(p_challenge)')
    expect(begin).toContain("NUMTODSINTERVAL(300, 'SECOND')")
    expect(begin).not.toContain('INSERT INTO odb_auth_sessions')
    expect(begin).toContain('SAVEPOINT odb_auth_begin_login')
    expect(begin).toContain('ROLLBACK TO odb_auth_begin_login')
  })

  it('serializes verification by user, rechecks challenge/version, and rate-limits independently of challenge replacement', () => {
    const verify = procedure('verify_two_factor')
    expect(verify).toContain("odb_rate_limit.enforce('AUTH_2FA_USER', l_user_id)")
    expect(verify).toContain("odb_rate_limit.failure('AUTH_2FA_USER', l_user_id)")
    expect(verify).toContain('l_token_version != l_challenge_version')
    expect(verify.match(/expires_at > SYSTIMESTAMP/g)).toHaveLength(2)
    const lockUser = verify.indexOf('FROM odb_auth_users')
    const lockChallenge = verify.lastIndexOf('FROM odb_auth_challenges')
    expect(lockUser).toBeLessThan(lockChallenge)
    expect(verify.slice(lockUser, lockChallenge)).toContain('FOR UPDATE')
    expect(verify.indexOf('DELETE FROM odb_auth_challenges')).toBeLessThan(
      verify.indexOf('open_session('),
    )
    expect(verify.indexOf('verify_totp(')).toBeLessThan(
      verify.indexOf('INSERT INTO odb_auth_factors'),
    )
    for (const name of ['reset_password', 'change_password'])
      expect(procedure(name)).toContain('DELETE FROM odb_auth_challenges WHERE user_id =')
  })

  it('returns ten recovery codes only on enrollment and consumes a recovery code before issuing a replacement-enrollment challenge', () => {
    const verify = procedure('verify_two_factor')
    expect(verify).toContain('FOR l_recovery IN 1..10 LOOP')
    expect(verify).toContain('code_hash')
    expect(verify).toContain('odb_auth_crypto.hash_token(l_recovery_code)')
    expect(verify).toContain('odb_auth_crypto.hash_token(UPPER(p_code))')
    const recovery = verify.slice(verify.indexOf('DELETE FROM odb_auth_recovery_codes WHERE ('))
    expect(recovery.indexOf('p_next_challenge :=')).toBeGreaterThan(0)
    expect(recovery.indexOf('RETURN;')).toBeLessThan(recovery.indexOf('open_session('))
    expect(recovery).toContain(
      "l_pending_secret := encrypt_value('odb-auth-totp:' || l_user_id, l_new_secret);",
    )
    expect(recovery).toContain(
      'UPDATE odb_auth_challenges SET token_hash = odb_auth_crypto.hash_token(p_next_challenge), secret = l_pending_secret,',
    )
    expect(verify).not.toMatch(/\b(?:UPDATE|INSERT|SELECT)\b[^\n]*\bencrypt_value\(/)
    expect(verify).toContain('last_counter = l_counter')
    expect(verify).toContain('token_version = token_version + 1')
    expect(verify).toContain('UPDATE odb_auth_sessions SET revoked_at = SYSTIMESTAMP')
    expect(verify).toContain('SAVEPOINT odb_auth_verify_factor')
    expect(verify).toContain('ROLLBACK TO odb_auth_verify_factor')
  })

  it('uses RFC 6238 SHA1, six digits, 30-second UTC counters and a one-step skew without accepting counter replay', () => {
    const crypto = odbAuthCrypto.toSQLUp()
    expect(crypto).toContain('DBMS_CRYPTO.HMAC_SH1')
    expect(crypto).toContain('2147483647')
    expect(crypto).toContain('SYS_EXTRACT_UTC(SYSTIMESTAMP)')
    expect(crypto).toContain('86400 / 30')
    expect(crypto).toContain('FOR l_drift IN -1..1 LOOP')
    expect(crypto).toContain('l_candidate > p_last_counter')
    expect(crypto).toContain('MOD(l_binary, 1000000)')
    expect(crypto).toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567')
    expect(crypto).not.toContain('[object Object]')
  })
})
