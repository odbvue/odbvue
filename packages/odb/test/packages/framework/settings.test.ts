import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { odbSettings } from '../../../src/packages/framework/settings/settings.js'
import { odbLiteral } from '../../../src/schema/attribute.js'

const KEY = 'A'.repeat(64)

describe('odbSettings (framework package odb_settings)', () => {
  const previousKey = process.env.ODBVUE_SETTINGS_MASTER_KEY

  beforeEach(() => {
    process.env.ODBVUE_SETTINGS_MASTER_KEY = KEY
  })

  afterEach(() => {
    if (previousKey === undefined) delete process.env.ODBVUE_SETTINGS_MASTER_KEY
    else process.env.ODBVUE_SETTINGS_MASTER_KEY = previousKey
  })

  describe('install / drop SQL', () => {
    it('toSQLUp() emits the table, spec and body under the odb_settings name', () => {
      const sql = odbSettings.toSQLUp()
      expect(sql).toContain('CREATE TABLE odb_settings_store (')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE odb_settings AS')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY odb_settings AS')
      expect(sql).not.toContain('pck_api_settings')
      expect(sql).not.toContain('app_settings')
    })

    it('toSQLUp() bakes the master key into the body and leaves no marker', () => {
      const sql = odbSettings.toSQLUp()
      expect(sql).toContain(`HEXTORAW('${KEY}')`)
      expect(sql).not.toContain('__ODB_SETTINGS_MASTER_KEY__')
    })

    it('toSQLUp({ masterKey }) overrides the environment key', () => {
      const key = 'B'.repeat(64)
      expect(odbSettings.toSQLUp({ masterKey: key })).toContain(`HEXTORAW('${key}')`)
    })

    it('toSQLUp() normalizes lowercase hex keys', () => {
      expect(odbSettings.toSQLUp({ masterKey: 'a'.repeat(64) })).toContain(
        `HEXTORAW('${'A'.repeat(64)}')`,
      )
    })

    it('toSQLUp() rejects a malformed master key', () => {
      expect(() => odbSettings.toSQLUp({ masterKey: 'too-short' })).toThrow(/64 hex characters/)
    })

    it('toSQLUp() falls back to the built-in default key when none is set', () => {
      delete process.env.ODBVUE_SETTINGS_MASTER_KEY
      const sql = odbSettings.toSQLUp()
      expect(sql).toContain('HEXTORAW(')
      expect(sql).not.toContain('__ODB_SETTINGS_MASTER_KEY__')
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
    })

    it('toSQLDown({ schema }) drops the qualified objects', () => {
      const sql = odbSettings.toSQLDown({ schema: 'APP_USER' })
      expect(sql).toContain('DROP PACKAGE APP_USER.odb_settings')
      expect(sql).toContain('DROP TABLE APP_USER.odb_settings_store')
    })
  })

  describe('call-expression helpers', () => {
    it('renders read / remove with literal or expression ids', () => {
      expect(odbSettings.read(odbLiteral('API_URL'))).toBe("odb_settings.read('API_URL')")
      expect(odbSettings.read('v_id')).toBe('odb_settings.read(v_id)')
      expect(odbSettings.remove(odbLiteral('API_URL'))).toBe("odb_settings.remove('API_URL')")
    })

    it('renders write() defaulting name to id and secret to N', () => {
      expect(odbSettings.write(odbLiteral('API_URL'), odbLiteral('https://x'))).toBe(
        "odb_settings.write('API_URL', 'API_URL', 'https://x', NULL, 'N')",
      )
    })

    it('renders write() with name, options and secret', () => {
      expect(
        odbSettings.write(odbLiteral('API_KEY'), 'p_api_key', {
          name: odbLiteral('Api Key'),
          options: 'v_opts',
          secret: true,
        }),
      ).toBe("odb_settings.write('API_KEY', 'Api Key', p_api_key, v_opts, 'Y')")
    })
  })
})
