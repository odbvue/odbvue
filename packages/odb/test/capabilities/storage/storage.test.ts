import { describe, expect, it } from 'vitest'
import {
  odbStorage,
  odbStoragePackage,
  storageFiles,
  storageTypes,
} from '../../../src/capabilities/storage/index.js'

describe('Storage', () => {
  const sql = odbStorage.toSQLUp({ schema: 'APP' })

  it('installs a BLOB store and a transport-independent package', () => {
    expect(sql).toContain('CREATE TABLE APP.odb_storage_files')
    expect(sql).toContain('content BLOB NOT NULL')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_storage AS')
    expect(sql).not.toContain('odb_http')
    expect(sql).not.toContain('DBMS_CLOUD')
    expect(odbStorage.types).toBe(storageTypes)
  })

  it('scopes every lookup and deletion to the owner', () => {
    expect(sql.match(/owner_id = p_owner_id/g)).toHaveLength(3)
    expect(sql).toContain('SQL%ROWCOUNT = 0')
    expect(sql).toContain('STORAGE_FILE_NOT_FOUND')
    expect(sql).toContain('p_after IS NULL OR id > p_after')
    expect(sql).toContain('FETCH FIRST NVL(p_limit, 50) ROWS ONLY')
  })

  it('validates filenames, metadata, pagination and server-computed byte sizes', () => {
    expect(sql).toContain('STORAGE_FILENAME_INVALID')
    expect(sql).toContain('STORAGE_MIME_TYPE_INVALID')
    expect(sql).toContain('STORAGE_META_INVALID')
    expect(sql).toContain('STORAGE_LIMIT_INVALID')
    expect(sql).toContain('l_file_size := DBMS_LOB.GETLENGTH(p_content)')
    expect(sql).toContain(`l_file_size > ${odbStorage.maxFileBytes}`)
    expect(sql).toContain('STORAGE_CONTENT_REQUIRED')
    expect(sql).toContain("meta CLOB DEFAULT '{}' NOT NULL CHECK (meta IS JSON)")
  })

  it('emits typed calls and drops the package before the store', () => {
    expect(odbStorage.write('u', 'f', 'm', 'b', 'id').toSQL()).toBe(
      'odb_storage.write(u, f, m, b, NULL, id)',
    )
    expect(odbStorage.read('u', 'id', 'f', 'm', 's', 'b', 'meta').toSQL()).toBe(
      'odb_storage.read(u, id, f, m, s, b, meta)',
    )
    expect(odbStorage.remove('u', 'id').toSQL()).toBe('odb_storage.remove(u, id)')
    const down = odbStorage.toSQLDown({ schema: 'APP' })
    expect(down.indexOf(odbStoragePackage.toSQLDown({ schema: 'APP' }))).toBeLessThan(
      down.indexOf(storageFiles.toSQLDown({ schema: 'APP' })),
    )
  })
})
