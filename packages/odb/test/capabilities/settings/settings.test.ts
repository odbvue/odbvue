import { describe, expect, it } from 'vitest'
import { odbSettings } from '../../../src/capabilities/settings/settings.js'

describe('Settings', () => {
  const sql = odbSettings.toSQLUp({ schema: 'APP' })

  it('installs the table and the odb_settings package', () => {
    expect(sql).toContain('CREATE TABLE APP.odb_settings_store')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_settings AS')
    expect(sql).toContain('PROCEDURE list')
    expect(sql).toContain('PROCEDURE read')
    expect(sql).toContain('PROCEDURE write')
    expect(sql).toContain('PROCEDURE remove')
  })

  it('implements list, read, write and remove in PL/SQL', () => {
    expect(sql).toContain('OPEN p_items FOR SELECT id, value, meta FROM odb_settings_store')
    expect(sql).toContain('p_after IS NULL OR id > p_after')
    expect(sql).toContain('ORDER BY id ASC FETCH FIRST NVL(p_limit, 50) ROWS ONLY')
    expect(sql).toContain('INTO p_value, p_meta FROM odb_settings_store WHERE id = p_id')
    expect(sql).toContain("raise_application_error(-20998, 'ODB_ERROR|NOT_FOUND|NOT_FOUND')")
    expect(sql).not.toContain('odb_http')
    expect(sql).toContain('MERGE INTO odb_settings_store target')
    expect(sql).toContain('DELETE FROM odb_settings_store WHERE id = p_id')
  })

  it('emits typed calls to the package procedures', () => {
    expect(odbSettings.read('p_id', 'l_value', 'l_meta').toSQL()).toBe(
      'odb_settings.read(p_id, l_value, l_meta)',
    )
    expect(odbSettings.write('p_id', 'p_value').toSQL()).toBe(
      'odb_settings.write(p_id, p_value, NULL)',
    )
    expect(odbSettings.list('NULL', 'NULL', 'p_items').toSQL()).toBe(
      'odb_settings.list(NULL, NULL, p_items)',
    )
    expect(odbSettings.remove('p_id').toSQL()).toBe('odb_settings.remove(p_id)')
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
})
