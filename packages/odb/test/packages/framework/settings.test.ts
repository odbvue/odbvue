import { describe, expect, it } from 'vitest'
import { odbSettings } from '../../../src/packages/framework/settings/settings.js'
import { odbLiteral } from '../../../src/schema/attribute.js'

describe('odbSettings (framework package odb_settings)', () => {
  describe('install / drop SQL', () => {
    it('toSQLUp() emits the table, spec and body under the odb_settings name', () => {
      const sql = odbSettings.toSQLUp()
      expect(sql).toContain('CREATE TABLE odb_settings_store (')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE odb_settings AS')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY odb_settings AS')
      expect(sql).not.toContain('pck_api_settings')
      expect(sql).not.toContain('app_settings')
    })

    it('toSQLUp() owns the local key without a separate secrets store', () => {
      const sql = odbSettings.toSQLUp()
      expect(sql).toContain('CREATE TABLE APP_SETTINGS_MASTER_KEY_LOCAL')
      expect(sql).toContain('DBMS_CRYPTO.RANDOMBYTES(32)')
      expect(sql).toContain(
        'WHERE NOT EXISTS (SELECT 1 FROM APP_SETTINGS_MASTER_KEY_LOCAL WHERE id = 1)',
      )
      expect(sql).not.toContain('odb_secrets_store')
      expect(sql).not.toContain('FUNCTION secret_matches')
      expect(sql).not.toContain('odb_kms.master_key()')
      expect(sql).not.toContain('CREATE OR REPLACE PACKAGE odb_secrets AS')
      expect(sql).not.toContain('HEXTORAW(')
      expect(sql).not.toContain('__ODB_SETTINGS_MASTER_KEY__')
      expect(sql).not.toContain('UTL_HTTP')
    })

    it('keeps regular and secret reads on their respective setting types', () => {
      const sql = odbSettings.toSQLUp()
      expect(sql).toContain("IF v_secret <> 'N' THEN")
      expect(sql).toContain("IF v_secret <> 'Y' THEN")
      expect(sql).toContain('FUNCTION read_regular (p_id IN VARCHAR2) RETURN VARCHAR2')
      expect(sql).toContain('FUNCTION read_secret (p_id IN VARCHAR2) RETURN VARCHAR2')
    })

    it('uses OCI Vault without installing a local master key', () => {
      const uri = 'https://secrets.example/20190301/secretbundles/key'
      const sql = odbSettings.vaultSecret(uri).toSQLUp({ schema: 'APP_USER' })
      expect(sql).toContain("credential_name => 'OCI$RESOURCE_PRINCIPAL'")
      expect(sql).toContain(uri)
      expect(sql).not.toContain('CREATE TABLE APP_USER.APP_SETTINGS_MASTER_KEY_LOCAL')
      expect(odbSettings.vaultSecret(uri).toSQLDown({ schema: 'APP_USER' })).not.toContain(
        'APP_SETTINGS_MASTER_KEY_LOCAL',
      )
    })

    it('toSQLUp({ schema }) qualifies the table and package names', () => {
      const sql = odbSettings.toSQLUp({ schema: 'APP_USER' })
      expect(sql).toContain('CREATE TABLE APP_USER.odb_settings_store (')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE APP_USER.odb_settings AS')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY APP_USER.odb_settings AS')
    })

    it('toSQLDown() drops the package and table', () => {
      const sql = odbSettings.toSQLDown()
      expect(sql).toContain('DROP PACKAGE odb_settings')
      expect(sql).toContain('DROP TABLE odb_settings_store')
      expect(sql).not.toContain('odb_secrets_store')
      expect(sql).toContain('DROP TABLE APP_SETTINGS_MASTER_KEY_LOCAL')
    })

    it('toSQLDown({ schema }) drops the qualified objects', () => {
      const sql = odbSettings.toSQLDown({ schema: 'APP_USER' })
      expect(sql).toContain('DROP PACKAGE APP_USER.odb_settings')
      expect(sql).toContain('DROP TABLE APP_USER.odb_settings_store')
    })
  })

  describe('call-expression helpers', () => {
    it('renders read / remove with literal or expression ids', () => {
      expect(odbSettings.read(odbLiteral('API_URL')).toSQL()).toBe("odb_settings.read('API_URL')")
      expect(odbSettings.readRegular(odbLiteral('API_URL')).toSQL()).toBe(
        "odb_settings.read_regular('API_URL')",
      )
      expect(odbSettings.readSecret(odbLiteral('API_KEY')).toSQL()).toBe(
        "odb_settings.read_secret('API_KEY')",
      )
      expect(odbSettings.read('v_id').toSQL()).toBe('odb_settings.read(v_id)')
      expect(odbSettings.remove(odbLiteral('API_URL')).toSQL()).toBe(
        "odb_settings.remove('API_URL')",
      )
    })

    it('renders write() defaulting name to id and secret to N', () => {
      expect(odbSettings.write(odbLiteral('API_URL'), odbLiteral('https://x')).toSQL()).toBe(
        "odb_settings.write('API_URL', 'API_URL', 'https://x', NULL, 'N')",
      )
    })

    it('renders write() with name, options and secret', () => {
      expect(
        odbSettings
          .write(odbLiteral('API_KEY'), 'p_api_key', {
            name: odbLiteral('Api Key'),
            options: 'v_opts',
            secret: true,
          })
          .toSQL(),
      ).toBe("odb_settings.write('API_KEY', 'Api Key', p_api_key, v_opts, 'Y')")
    })
  })
})
