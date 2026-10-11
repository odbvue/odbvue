import { describe, expect, it } from 'vitest'
import { odbLob, odbLobPackage } from '../../../src/helpers/lob/lob.js'
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
      expect(odbLob.clobToBlob('v_clob').toSQL()).toBe('odb_lob.clob_to_blob(v_clob)')
      expect(odbLob.blobToClob('v_blob').toSQL()).toBe('odb_lob.blob_to_clob(v_blob)')
      expect(odbLob.blobToBase64('v_blob').toSQL()).toBe('odb_lob.blob_to_base64(v_blob)')
      expect(odbLob.clobToBase64('v_clob').toSQL()).toBe('odb_lob.clob_to_base64(v_clob)')
      expect(odbLob.varchar2ToBase64('v_text').toSQL()).toBe('odb_lob.varchar2_to_base64(v_text)')
      expect(odbLob.base64ToBlob('v_b64').toSQL()).toBe('odb_lob.base64_to_blob(v_b64)')
      expect(odbLob.base64ToClob('v_b64').toSQL()).toBe('odb_lob.base64_to_clob(v_b64)')
      expect(odbLob.base64ToVarchar2('v_b64').toSQL()).toBe('odb_lob.base64_to_varchar2(v_b64)')
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

    describe('builder-defined implementation', () => {
      const sql = odbLob.toSQLUp()

      it('preserves all eight functions, numeric flags, defaults and conversion warnings', () => {
        const node = odbLobPackage.application()
        expect(node.functions).toHaveLength(8)
        expect(JSON.stringify(node)).not.toContain('"kind":"raw"')
        expect(sql).toContain('SUBTYPE boolean IS PLS_INTEGER RANGE 0..1;')
        expect(sql).toContain('p_charset_id IN INTEGER DEFAULT DBMS_LOB.DEFAULT_CSID')
        expect(sql).toContain('p_error_on_warning IN boolean DEFAULT 0')
        expect(sql).toContain('p_newline IN boolean DEFAULT 1')
        expect(sql).toContain('DBMS_LOB.CONVERTTOBLOB(')
        expect(sql).toContain('DBMS_LOB.CONVERTTOCLOB(')
        expect(sql).toContain('DBMS_LOB.WARN_INCONVERTIBLE_CHAR')
        expect(sql).toContain("raise_application_error(-20001, 'Error during lob conversion : '")
        expect(odbLob.clobToBlob('content', 'charset', '1').toSQL()).toBe(
          'odb_lob.clob_to_blob(content, charset, 1)',
        )
        expect(odbLob.blobToBase64('content', '0').toSQL()).toBe(
          'odb_lob.blob_to_base64(content, 0)',
        )
      })

      it('distinguishes NULL and empty LOBs and keeps newline/whitespace processing', () => {
        expect(sql).toContain('CASE WHEN p_blob IS NULL THEN NULL ELSE EMPTY_CLOB() END')
        expect(sql).toContain('CASE WHEN p_base64 IS NULL THEN NULL ELSE EMPTY_BLOB() END')
        expect(sql).toContain("TRANSLATE(p_value, 'a' || c_whitespace, 'a')")
        expect(sql).toContain(
          "REPLACE(UTL_RAW.CAST_TO_VARCHAR2(UTL_ENCODE.BASE64_ENCODE(p_value)), c_crlf, '')",
        )
        expect(sql).toContain(
          'RTRIM(UTL_RAW.CAST_TO_VARCHAR2(UTL_ENCODE.BASE64_ENCODE(p_value)), c_crlf)',
        )
      })

      it('keeps chunk sizes inside Oracle RAW/VARCHAR2 limits', () => {
        const constants = odbLobPackage.application().privateConstants!
        const encode = Number(
          constants.find((constant) => constant.name === 'c_max_enc_chunk_len')?.value,
        )
        const decode = Number(
          constants.find((constant) => constant.name === 'c_max_dec_chunk_len')?.value,
        )
        expect(encode).toBe(23760)
        expect(decode).toBe(31680)
        expect(encode % 3).toBe(0)
        expect(decode % 4).toBe(0)
        const encodedCharacters = (encode / 3) * 4
        expect(encodedCharacters + Math.ceil(encodedCharacters / 64) * 2 + 2).toBeLessThanOrEqual(
          32767,
        )
        expect(decode + 3).toBeLessThanOrEqual(32767)
        expect(sql).toContain('DBMS_LOB.SUBSTR(p_blob, c_max_enc_chunk_len, l_offset)')
        expect(sql).toContain('DBMS_LOB.READ(p_base64, l_amount, l_offset, l_buffer)')
      })

      it('prepends carry before computing the remainder and guards empty decoded chunks', () => {
        const combined = sql.indexOf('l_buffer := l_overflow || remove_whitespace(l_buffer);')
        const length = sql.indexOf('l_buffer_length := NVL(LENGTH(l_buffer), 0);', combined)
        const modulo = sql.indexOf('l_modulo := MOD(l_buffer_length, 4);', length)
        const append = sql.indexOf(
          'append_chunk(SUBSTR(l_buffer, 1, l_buffer_length - l_modulo));',
          modulo,
        )
        expect(combined).toBeGreaterThan(0)
        expect(length).toBeGreaterThan(combined)
        expect(modulo).toBeGreaterThan(length)
        expect(append).toBeGreaterThan(modulo)
        expect(sql).toContain(
          'l_overflow := CASE WHEN l_modulo > 0 THEN SUBSTR(l_buffer, 0 - l_modulo) ELSE NULL END;',
        )
        expect(sql).toMatch(/IF l_raw IS NOT NULL THEN\s+DBMS_LOB.WRITEAPPEND/)
      })

      it('uses a distinct read-only range index and writable encoding buffer', () => {
        expect(sql).toContain('FOR l_chunk_index IN 1..CEIL(l_length / c_max_enc_chunk_len) LOOP')
        expect(sql).toContain(
          'l_chunk := CASE WHEN l_chunk_index > 1 THEN l_separator ELSE NULL END',
        )
        expect(sql).toContain('DBMS_LOB.WRITEAPPEND(l_result, LENGTH(l_chunk), l_chunk)')
        expect(sql).not.toContain('FOR l_chunk IN')
      })
    })
  })
})
