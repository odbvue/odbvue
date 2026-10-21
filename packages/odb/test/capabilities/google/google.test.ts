import { describe, expect, it } from 'vitest'
import { odbGoogle } from '../../../src/capabilities/google/google.js'
import { odbGooglePackage } from '../../../src/capabilities/google/package.js'
import { odbLiteral, PlsqlExpression } from '../../../src/schema/attribute.js'
import { ODB_ERROR_NUMBER } from '../../../src/schema/errors.js'

// LOCAL generation only: no Oracle client, DB connection, browser or provider calls.
const sql = odbGoogle.toSQLUp()
const packageBody = sql.slice(sql.indexOf('CREATE OR REPLACE PACKAGE BODY'))
const routine = (name: string) => {
  name =
    (
      { start_login: 'start_transaction', complete: 'complete_transaction' } as Record<
        string,
        string
      >
    )[name] ?? name
  const match = packageBody.match(
    new RegExp(`(?:PROCEDURE|FUNCTION) ${name}(?:\\([^\\n]*\\))?(?: RETURN [^\\n]+)? IS\\n`, 'i'),
  )
  if (!match || match.index === undefined) throw new Error(`Missing body ${name}`)
  const start = match.index
  const end = packageBody.toLowerCase().indexOf(`end ${name};`, start)
  return packageBody.slice(start, end + name.length + 5)
}

describe('Google OIDC local SQL generation', () => {
  it('accepts only Google-hosted photos from verified claims and never overwrites an uploaded avatar', () => {
    const verify = routine('verify_token')
    expect(verify).toContain("'picture'")
    expect(verify).toContain('^https://lh[0-9]+[.]googleusercontent[.]com/')
    expect(routine('complete_transaction')).toContain(
      'odb_auth.update_google_avatar(l_subject, l_picture)',
    )
  })
  it('returns an email collision as an outcome so the consumed return path survives PL/SQL OUT propagation', () => {
    const complete = routine('complete_transaction')
    const login = complete.slice(complete.indexOf('odb_auth.login_google('))
    expect(login).toContain(`SQLCODE = ${ODB_ERROR_NUMBER}`)
    expect(login).toContain('ODB_ERROR\\|CONFLICT\\|GOOGLE_EMAIL_EXISTS')
    expect(login).toContain("p_outcome := 'conflict'")
    expect(login).toMatch(/p_outcome := 'conflict';\s+RETURN;/)
    expect(login).toContain('existing account requires authentication')
    expect(login).toContain('ELSE\n')
    expect(login).toContain('RAISE;')
    expect(complete.indexOf('p_return_path,')).toBeLessThan(
      complete.indexOf('odb_auth.login_google('),
    )
  })

  it('models runtime declarations and control flow instead of embedding handwritten bodies', () => {
    const application = odbGooglePackage.application()
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return
      if ('kind' in node && node.kind === 'raw') {
        expect(node).toMatchObject({ sql: expect.stringMatching(/^odb_audit\.error\('GOOGLE_/) })
      }
      for (const value of Object.values(node)) visit(value)
    }
    visit(application)
    const request = application.privateFunctions?.find((fn) => fn.name === 'request_json')
    expect(request?.body?.declarations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'l_context', type: 'UTL_HTTP.REQUEST_CONTEXT_KEY' }),
        expect.objectContaining({ name: 'l_request', type: 'UTL_HTTP.REQ' }),
        expect.objectContaining({ name: 'l_response', type: 'UTL_HTTP.RESP' }),
      ]),
    )
    for (const name of ['request_json', 'signing_key', 'verify_token', 'complete']) {
      expect(routine(name)).not.toMatch(/\bDECLARE\b/)
    }
  })
  it('exposes only typed, transport-independent calls', () => {
    expect(odbGoogle.enabled()).toBeInstanceOf(PlsqlExpression)
    expect(odbGoogle.enabled().toSQL()).toBe('odb_google.enabled()')
    expect(odbGoogle.publicUrl().toSQL()).toBe('odb_google.public_url()')
    expect(odbGoogle.start('l_path', 'l_url', 'l_browser').toSQL()).toBe(
      'odb_google.start_login(l_path, l_url, l_browser)',
    )
    expect(
      odbGoogle
        .complete(
          'l_state',
          'l_code',
          'l_browser',
          'l_error',
          'l_current_refresh',
          'l_refresh',
          'l_path',
          'l_outcome',
          'l_purpose',
        )
        .toSQL(),
    ).toBe(
      'odb_google.complete(l_state, l_code, l_browser, l_error, l_current_refresh, l_refresh, l_path, l_outcome, l_purpose)',
    )
    const publicNames = odbGooglePackage.application().procedures.map((p) => p.name)
    expect(publicNames).toEqual(['start_login', 'start_link', 'complete'])
    expect(sql).not.toMatch(/\bPROCEDURE\s+start\s*\(/i)
    expect(sql).not.toMatch(/\bodb_google\.start\s*\(/i)
    expect(sql).not.toMatch(/OWA_|HTP[.]|ORDS[.]|SET_COOKIE|tokeninfo|access_type=offline|HS256/i)
  })

  it('installs and drops both private-purpose tables in dependency order', () => {
    expect(sql).toContain('odb_google_transactions')
    expect(sql).toContain('odb_google_keys')
    expect(sql).toContain('state_hash')
    const transactions = sql.slice(0, sql.indexOf('CREATE TABLE odb_google_keys'))
    expect(transactions).toContain("purpose VARCHAR2(8 CHAR) DEFAULT 'login' NOT NULL")
    expect(transactions).toContain('user_id CHAR(32 CHAR)')
    expect(transactions).toContain('session_id CHAR(32 CHAR)')
    expect(transactions).toContain('token_version NUMBER')
    const down = odbGoogle.toSQLDown({ schema: 'app' })
    expect(down.indexOf('PACKAGE')).toBeLessThan(down.indexOf('TABLE'))
    expect(down).toContain('app.odb_google_transactions')
  })

  it('separates login and link purpose and binds link transactions only to authenticated server values', () => {
    const start = routine('start_transaction')
    expect(start).toContain('purpose, user_id, session_id, token_version')
    const linkStart = routine('start_link')
    expect(linkStart).toContain(
      'odb_auth.prepare_google_link(p_user_id, p_refresh_token, p_password, l_session_id, l_token_version)',
    )
    expect(linkStart).toContain(
      "start_transaction(p_return_path, 'link', p_user_id, l_session_id, l_token_version",
    )
    expect(linkStart).not.toContain('login_google')
    expect(packageBody).toContain("start_transaction(p_return_path, 'login', NULL, NULL, NULL")
    expect(packageBody).toContain(
      'p_provider_error, p_current_refresh, p_refresh_token, p_return_path, p_outcome, p_purpose',
    )
    const complete = routine('complete_transaction')
    expect(complete).toContain("p_purpose != 'login' AND p_purpose != 'link'")
    expect(complete).toContain(
      'p_return_path, p_purpose, l_user_id, l_session_id, l_token_version)',
    )
    const completeContract = odbGooglePackage
      .application()
      .procedures.find((procedure) => procedure.name === 'complete')!
    expect(
      completeContract.params.find((parameter) => parameter.name === 'p_purpose')?.direction,
    ).toBe('OUT')
    expect(complete).toContain('GOOGLE_PURPOSE_INVALID')
    expect(complete.indexOf('consume_transaction(')).toBeLessThan(
      complete.indexOf('GOOGLE_PURPOSE_INVALID'),
    )
    expect(complete.indexOf('GOOGLE_PURPOSE_INVALID')).toBeLessThan(
      complete.indexOf('request_json('),
    )
    expect(complete).toContain(
      'odb_auth.check_google_link(l_user_id, l_session_id, l_token_version, p_current_refresh)',
    )
    expect(complete.indexOf('check_google_link(')).toBeLessThan(
      complete.indexOf("= 'access_denied'"),
    )
    expect(complete.indexOf('check_google_link(')).toBeLessThan(complete.indexOf('load_config('))
    expect(complete.indexOf('verify_token(')).toBeLessThan(
      complete.indexOf('odb_auth.link_google('),
    )
    expect(complete).toContain("IF p_purpose = 'link' THEN")
    expect(complete).toContain(
      'odb_auth.link_google(l_user_id, l_session_id, l_token_version, p_current_refresh, l_subject)',
    )
    expect(routine('load_config')).toContain("odb_settings.read('AUTH_GOOGLE_REDIRECT_URI'")
    expect(routine('load_config')).not.toContain('p_purpose')
    expect(sql).not.toContain('AUTH_GOOGLE_LINK_REDIRECT_URI')
    expect(start).toContain('load_config(l_client_id, l_client_secret, l_redirect_uri)')
    expect(complete).toContain('load_config(l_client_id, l_client_secret, l_redirect_uri)')
    expect(complete).toContain('escape_value(l_redirect_uri)')
    expect(
      odbGoogle
        .startLink('p_path', 'p_user', 'p_refresh', 'p_password', 'l_url', 'l_browser')
        .toSQL(),
    ).toBe('odb_google.start_link(p_path, p_user, p_refresh, p_password, l_url, l_browser)')
    expect(complete).toMatch(/IF p_purpose = 'link' THEN\s+ROLLBACK;/)
    expect(complete).toContain("p_outcome := 'error'")
    const linkCall = complete.indexOf('odb_auth.link_google(')
    const linkBranch = complete.slice(
      complete.lastIndexOf("IF p_purpose = 'link' THEN", linkCall),
      complete.indexOf('ELSE', linkCall),
    )
    expect(linkBranch).not.toContain('login_google')
    expect(linkBranch).not.toContain('p_refresh_token :=')
    expect(odbGoogle).not.toHaveProperty('completeLink')
  })

  it('seeds exact missing-only defaults without enabling or overwriting credentials', () => {
    const seed = odbGoogle.seedSettings().toSQLUp({ schema: 'app' })
    for (const id of ['ENABLED', 'CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI']) {
      expect(seed).toContain(`AUTH_GOOGLE_${id}`)
    }
    expect(seed.match(/IF l_count = 0 THEN/g)).toHaveLength(4)
    expect(seed).not.toContain('WALLET')
    expect(seed).toContain("'AUTH_GOOGLE_ENABLED', 'N'")
    expect(seed).toContain("'AUTH_GOOGLE_CLIENT_ID', ''")
    expect(seed).toContain("'AUTH_GOOGLE_CLIENT_SECRET', ''")
    expect(seed).not.toContain('AUTH_GOOGLE_LINK_REDIRECT_URI')
    expect(seed).toContain('"secret":"Y"')
    expect(seed).not.toContain('.apps.googleusercontent.com')
    expect(seed).toContain('app.odb_settings_store')
    expect(odbGoogle.seedSettings().toSQLDown()).toBe('')
  })

  it('keeps enabled independent of secrets and validates configuration on actual use', () => {
    const enabled = routine('enabled')
    expect(enabled).toContain('AUTH_GOOGLE_ENABLED')
    expect(enabled).not.toMatch(/CLIENT_SECRET|CLIENT_ID|REDIRECT_URI/)
    expect(sql).not.toMatch(/p_wallet|l_wallet|AUTH_GOOGLE_WALLET_PATH/)
    expect(enabled).toContain('GOOGLE_CONFIG_INVALID')
    const config = routine('load_config')
    expect(config).toContain('GOOGLE_DISABLED')
    expect(config).toContain('AUTH_GOOGLE_CLIENT_SECRET')
    expect(config).toContain('TRIM(')
    expect(config).toContain('https://')
    expect(config).toContain('localhost|127[.]0[.]0[.]1|\\[::1\\]')
    expect(config).toContain('[:cntrl:]')
  })

  it('owns public URL validation without depending on HTTP transport', () => {
    const url = routine('public_url')
    expect(url).toContain("odb_settings.read('APP_PUBLIC_URL', l_app_url, l_meta)")
    expect(url).toContain('l_app_url IS NULL')
    expect(url).toContain('GOOGLE_APP_URL_INVALID')
    expect(url).toContain('^https://|^http://(localhost|127[.]0[.]0[.]1|\\[::1\\])')
    expect(url).toContain('RETURN l_app_url')
    expect(url).not.toMatch(/CLIENT_SECRET|Cookie|Origin|OWA_|HTP[.]/)
  })

  it('throttles direct framework calls before creating or consuming transactions', () => {
    for (const [name, scope, operation] of [
      ['start_login', 'AUTH_GOOGLE_START_IP', 'load_config('],
      ['complete', 'AUTH_GOOGLE_CALLBACK_IP', 'consume_transaction('],
    ]) {
      const source = routine(name)
      expect(source).toContain("SYS_CONTEXT('USERENV', 'IP_ADDRESS')")
      expect(source).toContain(`odb_rate_limit.enforce('${scope}', l_ip)`)
      expect(source).toContain(`odb_rate_limit.failure('${scope}', l_ip)`)
      expect(source.indexOf('odb_rate_limit.enforce')).toBeLessThan(
        source.indexOf('odb_rate_limit.failure'),
      )
      expect(source.indexOf('odb_rate_limit.failure')).toBeLessThan(source.indexOf(operation))
    }
  })

  it('generates independent CSPRNG state, browser binding, nonce and server-only PKCE', () => {
    expect(routine('random_value')).toContain('DBMS_CRYPTO.RANDOMBYTES(32)')
    const start = routine('start_login')
    expect(start.match(/:= random_value\(\)/g)).toHaveLength(4)
    expect(start).toContain('hash_value(l_state)')
    expect(start).toContain('hash_value(p_browser_token)')
    expect(start).toContain('hash_value(l_nonce)')
    expect(start).toContain("INTERVAL '5' MINUTE")
    expect(start).toContain('DELETE FROM odb_google_transactions')
    expect(start).toContain('scope=openid%20email%20profile')
    expect(start).toContain('response_type=code')
    expect(start).toContain('code_challenge_method=S256')
    expect(start).toContain("UTL_I18N.STRING_TO_RAW(l_verifier, 'AL32UTF8')")
    expect(start).not.toContain('&code_verifier=')
    expect(start).toContain('GOOGLE_RETURN_PATH_INVALID')
    expect(start).toContain('%0[aAdD]')
    expect(start).not.toMatch(/COMMIT/i)
  })

  it('consumes once autonomously only after a correct live browser binding', () => {
    const consume = routine('consume_transaction')
    expect(consume).toContain('PRAGMA AUTONOMOUS_TRANSACTION')
    expect(consume).toContain('FOR UPDATE')
    expect(consume).toContain('l_browser_hash := hash_value(p_browser_token)')
    expect(consume).toContain('browser_hash = l_browser_hash')
    expect(consume).toContain('expires_at > CAST(SYSTIMESTAMP AS TIMESTAMP)')
    expect(consume.indexOf('FOR UPDATE')).toBeLessThan(consume.indexOf('DELETE FROM'))
    expect(consume.indexOf('DELETE FROM')).toBeLessThan(consume.indexOf('COMMIT'))
    expect(consume).toContain('ROLLBACK')
    expect(consume).toContain('GOOGLE_STATE_INVALID')
    expect(consume).not.toContain('request_json')
    expect(consume).not.toMatch(/(?:WHERE|AND)[^\n]*hash_value\(/)
  })

  it('burns cancelled and failed callbacks, rechecks snapshot, and creates only trusted login sessions', () => {
    const complete = routine('complete')
    expect(complete.indexOf('consume_transaction(')).toBeLessThan(
      complete.indexOf("= 'access_denied'"),
    )
    expect(complete.indexOf('consume_transaction(')).toBeLessThan(complete.indexOf('request_json('))
    expect(complete).toContain('GOOGLE_CONFIG_CHANGED')
    expect(complete).toContain("p_outcome := 'cancelled'")
    expect(complete).toContain('GOOGLE_PROVIDER_ERROR')
    expect(complete).toContain('GOOGLE_CODE_INVALID')
    expect(complete.indexOf('verify_token(')).toBeLessThan(
      complete.indexOf('odb_auth.login_google('),
    )
    expect(complete).toContain(
      'odb_auth.login_google(l_subject, l_email, l_display_name, l_access_token, p_refresh_token)',
    )
    expect(complete).toContain("p_outcome := 'success'")
    expect(complete).toContain("odb_audit.error('GOOGLE_COMPLETE_FAILED')")
    expect(complete).toMatch(/GOOGLE_COMPLETE_FAILED[\s\S]*RAISE;/)
    expect(complete).not.toMatch(
      /l_tokens[.]get_string\('access_token'\)|required_string\(l_tokens, 'access_token'/,
    )
    expect(complete).not.toMatch(/UPDATE odb_auth_users|odb_auth[.](login|signup|reset_password)\(/)
    expect(sql).not.toContain('odb_auth_sessions')
    for (const match of sql.matchAll(/odb_audit[.]error\(([^)]*)\)/gi)) {
      expect(match[1]).toMatch(/^'GOOGLE_[A-Z_]+'$/)
    }
  })

  it('bounds HTTPS exchanges, isolates cookies, restores timeout and cleans up failures', () => {
    const request = routine('request_json')
    expect(request).toContain('https://oauth2.googleapis.com/token')
    expect(request).toContain('https://www.googleapis.com/oauth2/v3/certs')
    expect(request).toContain('CREATE_REQUEST_CONTEXT(enable_cookies => FALSE)')
    expect(request).not.toMatch(/wallet_path|SET_WALLET/)
    expect(request).toContain('SET_FOLLOW_REDIRECT(l_request, 0)')
    expect(request).toContain('GET_TRANSFER_TIMEOUT(l_prior_timeout)')
    expect(request).toContain('SET_TRANSFER_TIMEOUT(10)')
    expect(request.match(/SET_TRANSFER_TIMEOUT\(l_prior_timeout\)/g)).toHaveLength(2)
    expect(request).toContain('l_total > 65536')
    expect(request).toContain("UTL_I18N.STRING_TO_RAW(p_payload, 'AL32UTF8')")
    expect(request).toContain('UTL_RAW.LENGTH(l_bytes)')
    expect(request.match(/END_RESPONSE/g)).toHaveLength(2)
    expect(request.match(/DESTROY_REQUEST_CONTEXT/g)).toHaveLength(2)
    expect(request).not.toMatch(/SET_WALLET|SQLERRM|l_response[.]reason_phrase/)
    expect(routine('escape_value')).toContain("UTL_URL.ESCAPE(p_value, TRUE, 'AL32UTF8')")
  })

  it('uses only live public-key cache entries with bounded refresh and expiry', () => {
    expect(routine('read_keys')).toContain('expires_at > CAST(SYSTIMESTAMP AS TIMESTAMP)')
    expect(routine('store_keys')).toContain("INTERVAL '300' SECOND")
    const key = routine('signing_key')
    expect(key).toContain('FOR l_attempt IN 1..2 LOOP')
    expect(key).toContain('IF l_attempt = 1 THEN')
    expect(key).toContain("required_string(l_key, 'kid', 128) = p_kid")
    for (const check of ["'kty', 8) != 'RSA'", "'use', 8) != 'sig'", "'alg', 8) != 'RS256'"]) {
      expect(key).toContain(check)
    }
    for (const bound of ['< 256', '> 512'])
      expect(key).toContain(`UTL_RAW.LENGTH(l_modulus) ${bound}`)
    for (const bound of ['< 1', '> 4']) expect(key).toContain(`UTL_RAW.LENGTH(l_exponent) ${bound}`)
    expect(key).toContain('FOR l_i IN 0..l_keys.get_size() - 1 LOOP')
    expect(key).toContain('l_found = TRUE')
    expect(key).toContain('WHEN OTHERS THEN')
    expect(key).toContain('DBMS_LOB.FREETEMPORARY(l_document)')
  })

  it('assembles bounded unsigned DER SPKI and passes Base64 bytes to Oracle RSA VERIFY', () => {
    expect(routine('tlv')).toContain('l_size > 2048')
    expect(routine('tlv')).toContain("'81'")
    expect(routine('tlv')).toContain("'82'")
    expect(routine('unsigned_integer')).toContain("HEXTORAW('00')")
    const key = routine('signing_key')
    // rsaEncryption OID + NULL and a zero-unused-bits BIT STRING are SPKI, not naked PKCS#1.
    expect(key).toContain('300D06092A864886F70D0101010500')
    expect(key).toContain("tlv('03', UTL_RAW.CONCAT(HEXTORAW('00')")
    expect(key).toContain(
      "RETURN UTL_RAW.CAST_TO_RAW(REPLACE(REPLACE(UTL_RAW.CAST_TO_VARCHAR2(UTL_ENCODE.BASE64_ENCODE(l_der)), CHR(13), ''), CHR(10), ''))",
    )
    expect(key).not.toContain('PUBLIC KEY')
    expect(key).not.toContain('l_pem')
    const verify = routine('verify_token')
    expect(verify).toContain('DBMS_CRYPTO.VERIFY(')
    expect(verify).toContain(
      'l_signature, l_key, DBMS_CRYPTO.KEY_TYPE_RSA, DBMS_CRYPTO.SIGN_SHA256_RSA)',
    )
    expect(verify).toContain('l_verified IS NULL OR l_verified = FALSE')
  })

  it('rejects noncanonical encodings, ambiguous JSON, algorithms, key URLs and claim type confusion', () => {
    expect(routine('decode_url')).toContain('encode_url(l_result) != p_value')
    expect(routine('strict_object')).toContain('IS JSON STRICT WITH UNIQUE KEYS')
    expect(routine('strict_object')).toContain(
      'SELECT CASE WHEN p_document IS JSON STRICT WITH UNIQUE KEYS',
    )
    expect(routine('strict_object')).toContain('INTO l_valid FROM dual')
    expect(routine('strict_object')).not.toMatch(/IF[^;]*IS JSON/)
    expect(routine('strict_object')).toContain('on_error(1)')
    expect(routine('required_string')).toContain('l_element.is_string() = FALSE')
    expect(routine('required_number')).toContain('l_element.is_number() = FALSE')
    const verify = routine('verify_token')
    expect(verify).toContain('LENGTH(p_token) > 8192')
    expect(verify).toContain("'alg', 16) != 'RS256'")
    for (const name of ['jku', 'x5u', 'crit', 'b64'])
      expect(verify).toContain(`has_member(l_header, '${name}') = TRUE`)
    expect(verify).toContain("'kid', 128")
    expect(verify).toContain(
      "l_issuer != 'accounts.google.com' AND l_issuer != 'https://accounts.google.com'",
    )
    expect(verify).toContain("'azp', 256) != p_client_id")
    expect(verify).toContain('l_element.is_string() = FALSE')
    expect(verify).toContain('l_element.is_boolean() = FALSE')
    expect(verify).toContain("get_boolean('email_verified')")
    expect(verify).toContain('l_email_verified IS NULL OR l_email_verified = FALSE')
  })

  it('checks time, nonce and verified subject/email before crossing the auth boundary', () => {
    const verify = routine('verify_token')
    for (const check of [
      'l_exp <= l_now',
      'l_iat > l_now + 60',
      'l_iat < l_now - 600',
      'l_exp <= l_iat',
      "'nbf') > l_now + 60",
      "'nonce', 128)) != p_nonce_hash",
      "'sub', 255",
      '^[0-9]{1,255}$',
      "'email', 128",
      "'name', 256",
    ]) {
      expect(verify).toContain(check)
    }
    expect(verify).toContain('p_display_name := p_email')
    expect(verify).not.toMatch(/SQLERRM|odb_auth[.]login_google/)
    expect(sql).not.toContain('odb_auth_jwt')
    expect(odbGoogle.start(odbLiteral('/'), 'l_url', 'l_browser').toSQL()).toContain("'/'")
  })

  it('checks optional members without missing-path errors or weakening strict JSON validation', () => {
    const membership = routine('has_member')
    expect(membership).toContain('l_keys JSON_KEY_LIST')
    expect(membership).toContain('l_keys := p_object.get_keys()')
    expect(membership).toContain('FOR l_i IN 1..l_keys.COUNT LOOP')
    expect(membership).toContain('UTL_RAW.CAST_TO_RAW(l_keys(l_i)) = UTL_RAW.CAST_TO_RAW(p_key)')
    expect(membership).toContain('RETURN TRUE')
    expect(membership).toContain('RETURN FALSE')
    expect(membership).not.toMatch(/\.has\(|on_error|WHEN OTHERS/)
    expect(packageBody).not.toContain('.has(')
    expect(packageBody).not.toContain('on_error(0)')
    expect(routine('strict_object')).toContain('on_error(1)')
    for (const name of ['required_string', 'required_number']) {
      expect(routine(name)).toContain('has_member(p_object, p_key) = FALSE')
      expect(routine(name)).toContain('RAISE VALUE_ERROR')
    }
    const verify = routine('verify_token')
    for (const key of ['azp', 'nbf', 'name']) {
      expect(verify).toContain(`has_member(l_claims, '${key}') = TRUE`)
    }
  })
})
