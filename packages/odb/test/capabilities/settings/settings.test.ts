import { describe, expect, it, vi } from 'vitest'
import {
  odbSettings,
  odbSettingsPackage,
  settingsStore,
} from '../../../src/capabilities/settings/settings.js'
import * as settings from '../../../src/capabilities/settings/index.js'

describe('Settings', () => {
  const sql = odbSettings.toSQLUp({ schema: 'APP' })

  it('ignores the retired application master-key environment variable', () => {
    vi.stubEnv('ODBVUE_APP_MASTER_KEY', 'obsolete-key')
    try {
      expect(odbSettings.toSQLUp()).not.toContain('obsolete-key')
      expect(odbSettings.toSQLUp()).not.toContain('c_master_key_local')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('exports the same capability, package and table through the barrel', () => {
    expect(settings.odbSettings).toBe(odbSettings)
    expect(settings.odbSettingsPackage).toBe(odbSettingsPackage)
    expect(settings.settingsStore).toBe(settingsStore)
    expect(settings.settingsTypes).toBe(odbSettings.types)
  })

  it('installs the table and the odb_settings package', () => {
    expect(sql).toContain('CREATE TABLE APP.odb_settings_store')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_settings AS')
    expect(sql).toContain('PROCEDURE list')
    expect(sql).toContain('PROCEDURE read')
    expect(sql).toContain('PROCEDURE write')
    expect(sql).toContain('PROCEDURE remove')
  })

  it('implements list, read, write and remove in PL/SQL', () => {
    expect(sql).toContain(
      "OPEN p_items FOR SELECT id, CASE WHEN secret = 'Y' THEN TO_CLOB('********') ELSE value END AS value, meta FROM odb_settings_store",
    )
    expect(sql).toContain('p_after IS NULL OR id > p_after')
    expect(sql).toContain('ORDER BY id ASC FETCH FIRST NVL(p_limit, 50) ROWS ONLY')
    expect(sql).toContain(
      'INTO l_stored_value, p_meta, l_secret FROM odb_settings_store WHERE id = p_id',
    )
    expect(sql).toContain("raise_application_error(-20998, 'ODB_ERROR|NOT_FOUND|NOT_FOUND')")
    expect(sql).not.toContain('odb_http')
    expect(sql).toContain('MERGE INTO odb_settings_store target')
    expect(sql).toContain('DELETE FROM odb_settings_store WHERE id = p_id')
  })

  it('stores meta as a CLOB constrained to JSON', () => {
    expect(sql).toContain("meta CLOB DEFAULT '{}' NOT NULL CHECK (meta IS JSON)")
    expect(sql).toContain(
      "GENERATED ALWAYS AS (NVL(JSON_VALUE(meta, '$.secret' RETURNING VARCHAR2(1) ERROR ON ERROR NULL ON EMPTY), 'N')) VIRTUAL",
    )
    expect(sql).toContain("CHECK (secret IN ('Y', 'N'))")
    expect(sql).toContain('value CLOB')
  })

  it('emits typed calls to the package procedures', () => {
    expect(odbSettings.read('p_id', 'l_value', 'l_meta').toSQL()).toBe(
      'odb_settings.read(p_id, l_value, l_meta)',
    )
    expect(odbSettings.readMasked('p_id', 'l_value', 'l_meta').toSQL()).toBe(
      'odb_settings.read_masked(p_id, l_value, l_meta)',
    )
    expect(odbSettings.write('p_id', 'p_value').toSQL()).toBe(
      'odb_settings.write(p_id, p_value, NULL)',
    )
    expect(odbSettings.list('NULL', 'NULL', 'p_items').toSQL()).toBe(
      'odb_settings.list(NULL, NULL, p_items)',
    )
    expect(odbSettings.remove('p_id').toSQL()).toBe('odb_settings.remove(p_id)')
  })

  it('keeps list cursor metadata and the response shape intact while masking secrets', () => {
    expect(odbSettings.list('after', 'limit', 'items').cursors?.ITEMS).toEqual([
      { name: 'id', type: 'string', nullable: false },
      { name: 'value', type: 'clob', nullable: true },
      { name: 'meta', type: 'json', nullable: false },
    ])
    expect(sql).toContain('read_value(p_id, 0, p_value, p_meta)')
    expect(sql).toContain('read_value(p_id, 1, p_value, p_meta)')
    expect(sql).toMatch(
      /IF p_masked = 1 THEN\s+p_value := '\*{8}';\s+ELSE\s+p_value := decrypt_value\(p_id, l_stored_value\)/,
    )
  })

  it('encrypts only secret writes and preserves metadata on ordinary updates', () => {
    expect(sql).toContain(
      'SELECT meta, secret INTO l_effective_meta, l_existing_secret FROM odb_settings_store WHERE id = p_id FOR UPDATE',
    )
    expect(sql).toContain('l_effective_meta := NVL(p_meta, l_effective_meta)')
    expect(sql).toContain("IF l_existing_secret = 'Y' THEN")
    expect(sql).toContain(`JSON_MERGEPATCH(l_effective_meta, '{"secret":"Y"}' RETURNING CLOB)`)
    expect(sql).toContain(
      `SELECT JSON_MERGEPATCH(l_effective_meta, '{"secret":"Y"}' RETURNING CLOB) INTO l_effective_meta FROM dual`,
    )
    expect(sql).not.toContain('l_effective_meta := JSON_MERGEPATCH')
    expect(sql).toContain("IF p_value = '********' THEN")
    expect(sql).toContain('SETTINGS_SECRET_MASKED_VALUE')
    expect(sql).toMatch(
      /l_stored_value := encrypt_value\(p_id, p_value\);\s+ELSE\s+l_stored_value := TO_CLOB\(p_value\)/,
    )
    expect(sql).toContain('IF LENGTH(p_value) > 2000 THEN')
    expect(sql).toContain('SETTINGS_VALUE_TOO_LONG')
    expect(sql).toContain('SETTINGS_META_INVALID')
    expect(sql).toContain('SETTINGS_SECRET_INVALID')
    expect(sql).toContain(
      "l_secret := NVL(JSON_VALUE(l_effective_meta, '$.secret' RETURNING VARCHAR2(10) ERROR ON ERROR NULL ON EMPTY), 'N')",
    )
  })

  it('prevents metadata replacement from downgrading any existing secret', () => {
    const write = sql.slice(
      sql.indexOf('PROCEDURE write(', sql.indexOf('CREATE OR REPLACE PACKAGE BODY')),
      sql.indexOf('PROCEDURE remove(', sql.indexOf('CREATE OR REPLACE PACKAGE BODY')),
    )
    expect(write).toMatch(
      /WHEN NO_DATA_FOUND THEN\s+l_effective_meta := '\{\}';\s+l_existing_secret := 'N';/,
    )
    const replacement = write.indexOf('l_effective_meta := NVL(p_meta, l_effective_meta)')
    const preservation = write.indexOf("IF l_existing_secret = 'Y' THEN")
    const encryption = write.indexOf("IF l_secret = 'Y' THEN")
    expect(replacement).toBeGreaterThan(-1)
    expect(preservation).toBeGreaterThan(replacement)
    expect(encryption).toBeGreaterThan(preservation)
    expect(write).toMatch(
      /IF l_existing_secret = 'Y' THEN\s+l_secret := 'Y';\s+SELECT JSON_MERGEPATCH\(l_effective_meta, '\{"secret":"Y"\}' RETURNING CLOB\) INTO l_effective_meta FROM dual;\s+END IF;/,
    )
    expect(write).not.toContain('SMTP_PASSWORD')
    expect(write).not.toContain('AUTH_JWT_SECRET')
  })

  it('uses authenticated AES-256 encryption, random IVs, UTF-8 and setting-bound MACs', () => {
    expect(sql).toContain('DBMS_CRYPTO.RANDOMBYTES(16)')
    expect(sql).toContain(
      'DBMS_CRYPTO.ENCRYPT_AES256 + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_PKCS5',
    )
    expect(sql).toContain("UTL_I18N.STRING_TO_RAW(p_value, 'AL32UTF8')")
    expect(sql).toContain('UTL_I18N.RAW_TO_CHAR(DBMS_CRYPTO.DECRYPT')
    expect(sql).toContain("'odb-settings:encryption'")
    expect(sql).toContain("'odb-settings:authentication'")
    expect(sql).toContain("UTL_I18N.STRING_TO_RAW(p_id, 'AL32UTF8')")
    expect(sql).toContain('SETTINGS_CIPHERTEXT_INVALID')
    const decrypt = sql.slice(
      sql.indexOf('FUNCTION decrypt_value(p_id', sql.indexOf('CREATE OR REPLACE PACKAGE BODY')),
    )
    expect(decrypt.indexOf('UTL_RAW.COMPARE')).toBeLessThan(decrypt.indexOf('DBMS_CRYPTO.DECRYPT'))
    expect(sql).toContain(
      "RETURN TO_CLOB('v1:' || RAWTOHEX(l_iv) || RAWTOHEX(l_mac) || RAWTOHEX(l_ciphertext))",
    )
    expect(sql).toContain('IF p_value IS NULL THEN')
  })

  it('preserves LOB, RAW conversion and merge expressions when using typed wrappers', () => {
    expect(sql).toContain('p_value := DBMS_LOB.SUBSTR(l_stored_value, 2000, 1)')
    expect(sql).toContain('DBMS_LOB.GETLENGTH(p_value) > 32767')
    expect(sql).toContain('l_envelope := DBMS_LOB.SUBSTR(p_value, 32767, 1)')
    expect(sql).toContain('l_iv := HEXTORAW(SUBSTR(l_envelope, 4, 32))')
    expect(sql).toContain('l_mac := HEXTORAW(SUBSTR(l_envelope, 36, 64))')
    expect(sql).toContain('l_ciphertext := HEXTORAW(SUBSTR(l_envelope, 100))')
    expect(sql).toContain('meta = NVL(source.meta, target.meta)')
    expect(sql).toContain("NVL(source.meta, '{}')")
  })

  it.each([
    [
      'https://secrets.vaults.eu-stockholm-1.oci.oraclecloud.com/20190301/secretbundles/ocid1.vaultsecret.oc1..aaaaaaaaexample',
      true,
    ],
    [
      'https://secrets.vaults.us-phoenix-1.oci.oraclecloud.com/20190301/secretbundles/ocid1.vaultsecret.oc1.phx.aaaaaaaaexample',
      true,
    ],
    [
      'https://secrets.vaults.eu-stockholm-1.oci.oraclecloud.com/20190301/secretbundles/ocid1.secret.oc1..aaaaaaaaexample',
      false,
    ],
    [
      'https://secrets.vaults.eu-stockholm-1.oci.oraclecloud.com/20190301/secretbundles/ocid1.key.oc1..aaaaaaaaexample',
      false,
    ],
    ['https://secrets.vaults.eu-stockholm-1.oci.oraclecloud.com/20190301/secretbundles/', false],
    [
      'https://secrets.vaults.eu-stockholm-1.oci.oraclecloud.com/20190301/secretbundles/ocid1.vaultsecret.',
      false,
    ],
    [
      'http://secrets.vaults.eu-stockholm-1.oci.oraclecloud.com/20190301/secretbundles/ocid1.vaultsecret.oc1..aaaaaaaaexample',
      false,
    ],
    [
      'https://secrets.vaults.eu-stockholm-1.oci.oraclecloud.com.evil.example/20190301/secretbundles/ocid1.vaultsecret.oc1..aaaaaaaaexample',
      false,
    ],
    ['https://example.com/20190301/secretbundles/ocid1.vaultsecret.oc1..aaaaaaaaexample', false],
    [
      'https://secrets.vaults.eu-stockholm-1.oci.oraclecloud.com/20190301/secrets/ocid1.vaultsecret.oc1..aaaaaaaaexample',
      false,
    ],
  ])('validates the generated Vault URI pattern for %s', (uri, expected) => {
    const pattern = sql.match(/REGEXP_LIKE\(l_uri, '([^']+)'\)/)?.[1]
    if (pattern === undefined) throw new Error('Generated Vault URI validation pattern is missing.')
    expect(new RegExp(pattern).test(uri)).toBe(expected)
  })

  it('loads Vault exclusively when configured and logs and rethrows failures', () => {
    expect(sql).toContain('APP_SETTINGS_MASTER_KEY_URI')
    expect(sql).toContain(
      "SELECT MAX(DBMS_LOB.SUBSTR(value, 2000, 1)) INTO l_uri FROM odb_settings_store WHERE id = 'APP_SETTINGS_MASTER_KEY_URI'",
    )
    expect(sql).toContain("credential_name => ''OCI$RESOURCE_PRINCIPAL''")
    expect(sql).toContain('DBMS_CLOUD.GET_RESPONSE_STATUS_CODE')
    expect(sql).toContain('SETTINGS_VAULT_SECRET_MISSING')
    expect(sql).toContain('SETTINGS_VAULT_REQUEST_FAILED')
    expect(sql).toContain('method => DBMS_CLOUD.METHOD_GET')
    expect(sql).toContain("END;' USING IN l_uri, OUT l_key")
    expect(sql).toContain('odb_audit.error(')
    expect(sql).toContain("odb_audit.error('Settings master key: key loading failed')")
    expect(sql).toMatch(/WHEN OTHERS THEN\s+odb_audit.error\([^\n]+\);\s+RAISE;/)
    expect(sql).not.toContain('odb_audit.warn(')
    expect(sql).not.toContain('fallback')
    expect(sql).toContain('SETTINGS_MASTER_KEY_INVALID')
    expect(sql).toContain('SETTINGS_MASTER_KEY_URI_INVALID')
    expect(sql).not.toContain('SQLERRM')
    expect(sql).toMatch(
      /IF l_uri IS NOT NULL THEN[\s\S]+EXECUTE IMMEDIATE[\s\S]+ELSE\s+SELECT DBMS_CRYPTO.HASH/,
    )
    expect(sql).toContain('IF (l_key IS NULL OR UTL_RAW.LENGTH(l_key) != 32) THEN')
  })

  it('derives the local key deterministically from DB_UNIQUE_NAME using typed SQL', () => {
    expect(sql).toContain(
      "SELECT DBMS_CRYPTO.HASH(UTL_I18N.STRING_TO_RAW(SYS_CONTEXT('USERENV', 'DB_UNIQUE_NAME'), 'AL32UTF8'), DBMS_CRYPTO.HASH_SH256) INTO l_key FROM dual",
    )
    expect(sql).not.toContain('c_master_key_local')
    expect(sql).not.toContain('v$database')
  })

  it('caches validated local and Vault keys per session and reloads when the URI changes', () => {
    expect(sql).toContain('g_master_key RAW(32);')
    expect(sql).toContain('g_master_key_uri VARCHAR2(2000);')
    expect(sql).toContain(
      'IF (g_master_key IS NOT NULL AND (l_uri = g_master_key_uri OR (l_uri IS NULL AND g_master_key_uri IS NULL))) THEN',
    )
    expect(sql).toMatch(
      /RETURN g_master_key;\s+END IF;\s+g_master_key := NULL;\s+g_master_key_uri := NULL;/,
    )
    expect(sql).toMatch(
      /SETTINGS_MASTER_KEY_INVALID'\);\s+END IF;\s+g_master_key_uri := l_uri;\s+g_master_key := l_key;\s+RETURN l_key;/,
    )
    const hit = sql.indexOf('RETURN g_master_key;')
    expect(sql.indexOf('INTO l_uri')).toBeLessThan(hit)
    expect(hit).toBeLessThan(sql.indexOf('EXECUTE IMMEDIATE'))
    expect(hit).toBeLessThan(sql.indexOf('SELECT DBMS_CRYPTO.HASH'))
  })

  it('seeds and removes settings through the package', () => {
    const seed = odbSettings.seed({ id: 'VERSION', value: "1'0", meta: { label: 'Version' } })
    expect(seed.toSQLUp({ schema: 'APP' })).toContain(
      `APP.odb_settings.write('VERSION', '1''0', '{"label":"Version"}')`,
    )
    expect(seed.toSQLDown({ schema: 'APP' })).toContain(`APP.odb_settings.remove('VERSION')`)
    expect(() => odbSettings.seed()).toThrow('at least one setting')
  })

  it('drops the package before the table', () => {
    const down = odbSettings.toSQLDown({ schema: 'APP' })
    expect(down.indexOf('DROP PACKAGE APP.odb_settings')).toBeLessThan(
      down.indexOf('odb_settings_store'),
    )
  })

  it.each(['SOME_SECRET', 'ANOTHER_SECRET'])('allows empty secret seeds for %s', (id) => {
    const seed = odbSettings.seed({ id, value: '', meta: { secret: 'Y' } })
    expect(seed.toSQLUp({ schema: 'APP' })).toContain(
      `APP.odb_settings.write('${id}', '', '{"secret":"Y"}')`,
    )
    expect(seed.toSQLDown({ schema: 'APP' })).toContain(`APP.odb_settings.remove('${id}')`)
  })

  it.each(['actual-secret', ' ', '********'])('rejects non-empty secret seeds (%s)', (value) => {
    expect(() =>
      odbSettings.seed(
        { id: 'VERSION', value: '1.0' },
        { id: 'SOME_SECRET', value, meta: { secret: 'Y' } },
      ),
    ).toThrow('Secret values must not be embedded in migrations.')
  })

  it.each([undefined, {}, { secret: 'N' as const }])(
    'preserves seed values not marked secret (%j)',
    (meta) => {
      for (const id of ['VERSION', 'SMTP_PASSWORD', 'AUTH_JWT_SECRET']) {
        expect(odbSettings.seed({ id, value: '1.0', meta }).toSQLUp()).toContain(
          `odb_settings.write('${id}', '1.0', ${meta ? `'${JSON.stringify(meta)}'` : 'NULL'})`,
        )
      }
    },
  )

  it('revalidates secret values and metadata before generating SQL', () => {
    const setting = { id: 'SOME_SECRET', value: '', meta: { secret: 'Y' as 'Y' | 'N' } }
    const seed = odbSettings.seed(setting)
    setting.value = 'actual-secret'
    expect(() => seed.toSQLUp()).toThrow('Secret values must not be embedded in migrations.')
    setting.meta.secret = 'N'
    expect(seed.toSQLUp()).toContain("'actual-secret'")
    setting.meta.secret = 'Y'
    expect(() => seed.toSQLUp({ schema: 'APP' })).toThrow(
      'Secret values must not be embedded in migrations.',
    )
  })
})
