import { describe, expect, it } from 'vitest'
import { odbLob } from '../../../src/packages/framework/lob/lob.js'
import { BlobVar, ClobVar, Varchar2Var } from '../../../src/schema/attribute.js'

describe('odbLob (framework package odb_lob)', () => {
  describe('install / drop SQL', () => {
    it('toSQLUp() emits the spec and body under the odb_lob name', () => {
      const sql = odbLob.toSQLUp()
      expect(sql).toContain('CREATE OR REPLACE PACKAGE odb_lob AS')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY odb_lob AS')
      expect(sql).not.toContain('pck_api_lob')
    })

    it('toSQLUp({ schema }) qualifies the package name', () => {
      const sql = odbLob.toSQLUp({ schema: 'APP_USER' })
      expect(sql).toContain('CREATE OR REPLACE PACKAGE APP_USER.odb_lob AS')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY APP_USER.odb_lob AS')
    })

    it('toSQLDown() drops odb_lob', () => {
      expect(odbLob.toSQLDown()).toContain('DROP PACKAGE odb_lob')
    })

    it('toSQLDown({ schema }) drops the qualified package', () => {
      expect(odbLob.toSQLDown({ schema: 'APP_USER' })).toContain('DROP PACKAGE APP_USER.odb_lob')
    })
  })

  describe('call-expression helpers', () => {
    it('render odb_lob.* calls', () => {
      expect(odbLob.clobToBlob('v_clob')).toBe('odb_lob.clob_to_blob(v_clob)')
      expect(odbLob.blobToClob('v_blob')).toBe('odb_lob.blob_to_clob(v_blob)')
      expect(odbLob.blobToBase64('v_blob')).toBe('odb_lob.blob_to_base64(v_blob)')
      expect(odbLob.clobToBase64('v_clob')).toBe('odb_lob.clob_to_base64(v_clob)')
      expect(odbLob.varchar2ToBase64('v_text')).toBe('odb_lob.varchar2_to_base64(v_text)')
      expect(odbLob.base64ToBlob('v_b64')).toBe('odb_lob.base64_to_blob(v_b64)')
      expect(odbLob.base64ToClob('v_b64')).toBe('odb_lob.base64_to_clob(v_b64)')
      expect(odbLob.base64ToVarchar2('v_b64')).toBe('odb_lob.base64_to_varchar2(v_b64)')
    })
  })

  describe('typed-var helpers', () => {
    it('ClobVar / BlobVar / Varchar2Var emit odb_lob.* expressions', () => {
      expect(new ClobVar('v_c', 'CLOB').toBase64().toSQL()).toBe('odb_lob.clob_to_base64(v_c)')
      expect(new ClobVar('v_c', 'CLOB').toBlob().toSQL()).toBe('odb_lob.clob_to_blob(v_c)')
      expect(new BlobVar('v_b', 'BLOB').toBase64().toSQL()).toBe('odb_lob.blob_to_base64(v_b)')
      expect(new BlobVar('v_b', 'BLOB').toClob().toSQL()).toBe('odb_lob.blob_to_clob(v_b)')
      expect(new Varchar2Var('v_s', 'VARCHAR2').toBase64().toSQL()).toBe(
        'odb_lob.varchar2_to_base64(v_s)',
      )
    })
  })
})
