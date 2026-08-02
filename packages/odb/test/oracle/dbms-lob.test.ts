import { describe, expect, it } from 'vitest'
import { odbDbmsLob } from '../../src/packages/oracle/dbms-lob.js'

describe('odbDbmsLob', () => {
  describe('functions (expressions)', () => {
    it('getLength → INTEGER', () => {
      const e = odbDbmsLob.getLength('v_clob')
      expect(e.toSQL()).toBe('DBMS_LOB.GETLENGTH(v_clob)')
      expect(e.type).toBe('INTEGER')
    })

    it('getChunkSize / getStorageLimit', () => {
      expect(odbDbmsLob.getChunkSize('v_blob').toSQL()).toBe('DBMS_LOB.GETCHUNKSIZE(v_blob)')
      expect(odbDbmsLob.getStorageLimit('v_blob').toSQL()).toBe(
        'DBMS_LOB.GET_STORAGE_LIMIT(v_blob)',
      )
    })

    it('compare with all optional args', () => {
      expect(odbDbmsLob.compare('v_a', 'v_b').toSQL()).toBe('DBMS_LOB.COMPARE(v_a, v_b)')
      expect(odbDbmsLob.compare('v_a', 'v_b', 100, 1, 1).toSQL()).toBe(
        'DBMS_LOB.COMPARE(v_a, v_b, 100, 1, 1)',
      )
    })

    it('instr', () => {
      expect(odbDbmsLob.instr('v_clob', 'v_pat', 1, 2).toSQL()).toBe(
        'DBMS_LOB.INSTR(v_clob, v_pat, 1, 2)',
      )
    })

    it('substr → VARCHAR2 and substrRaw → RAW', () => {
      const c = odbDbmsLob.substr('v_clob', 100, 1)
      expect(c.toSQL()).toBe('DBMS_LOB.SUBSTR(v_clob, 100, 1)')
      expect(c.type).toBe('VARCHAR2')
      const b = odbDbmsLob.substrRaw('v_blob', 100)
      expect(b.toSQL()).toBe('DBMS_LOB.SUBSTR(v_blob, 100)')
      expect(b.type).toBe('RAW')
    })

    it('isOpen / isTemporary / fileExists / fileIsOpen', () => {
      expect(odbDbmsLob.isOpen('v_lob').toSQL()).toBe('DBMS_LOB.ISOPEN(v_lob)')
      expect(odbDbmsLob.isTemporary('v_lob').toSQL()).toBe('DBMS_LOB.ISTEMPORARY(v_lob)')
      expect(odbDbmsLob.fileExists('v_bfile').toSQL()).toBe('DBMS_LOB.FILEEXISTS(v_bfile)')
      expect(odbDbmsLob.fileIsOpen('v_bfile').toSQL()).toBe('DBMS_LOB.FILEISOPEN(v_bfile)')
    })

    it('getContentType → VARCHAR2', () => {
      const e = odbDbmsLob.getContentType('v_blob')
      expect(e.toSQL()).toBe('DBMS_LOB.GETCONTENTTYPE(v_blob)')
      expect(e.type).toBe('VARCHAR2')
    })
  })

  describe('procedures (statement strings)', () => {
    it('append', () => {
      expect(odbDbmsLob.append('v_dest', 'v_src')).toBe('DBMS_LOB.APPEND(v_dest, v_src)')
    })

    it('copy with optional offsets', () => {
      expect(odbDbmsLob.copy('v_dest', 'v_src', 100)).toBe('DBMS_LOB.COPY(v_dest, v_src, 100)')
      expect(odbDbmsLob.copy('v_dest', 'v_src', 100, 1, 1)).toBe(
        'DBMS_LOB.COPY(v_dest, v_src, 100, 1, 1)',
      )
    })

    it('createTemporary renders a boolean cache flag as TRUE/FALSE', () => {
      expect(odbDbmsLob.createTemporary('v_tmp', true, odbDbmsLob.SESSION)).toBe(
        'DBMS_LOB.CREATETEMPORARY(v_tmp, TRUE, DBMS_LOB.SESSION)',
      )
      expect(odbDbmsLob.createTemporary('v_tmp', false)).toBe(
        'DBMS_LOB.CREATETEMPORARY(v_tmp, FALSE)',
      )
    })

    it('freeTemporary / open / close / trim / erase', () => {
      expect(odbDbmsLob.freeTemporary('v_tmp')).toBe('DBMS_LOB.FREETEMPORARY(v_tmp)')
      expect(odbDbmsLob.open('v_lob', odbDbmsLob.LOB_READWRITE)).toBe(
        'DBMS_LOB.OPEN(v_lob, DBMS_LOB.LOB_READWRITE)',
      )
      expect(odbDbmsLob.close('v_lob')).toBe('DBMS_LOB.CLOSE(v_lob)')
      expect(odbDbmsLob.trim('v_lob', 10)).toBe('DBMS_LOB.TRIM(v_lob, 10)')
      expect(odbDbmsLob.erase('v_lob', 5, 1)).toBe('DBMS_LOB.ERASE(v_lob, 5, 1)')
    })

    it('write / writeAppend / read', () => {
      expect(odbDbmsLob.write('v_lob', 5, 1, 'v_buf')).toBe('DBMS_LOB.WRITE(v_lob, 5, 1, v_buf)')
      expect(odbDbmsLob.writeAppend('v_lob', 5, 'v_buf')).toBe(
        'DBMS_LOB.WRITEAPPEND(v_lob, 5, v_buf)',
      )
      expect(odbDbmsLob.read('v_lob', 'v_amt', 1, 'v_buf')).toBe(
        'DBMS_LOB.READ(v_lob, v_amt, 1, v_buf)',
      )
    })

    it('fileOpen / fileClose / fileCloseAll', () => {
      expect(odbDbmsLob.fileOpen('v_bfile')).toBe('DBMS_LOB.FILEOPEN(v_bfile)')
      expect(odbDbmsLob.fileOpen('v_bfile', odbDbmsLob.FILE_READONLY)).toBe(
        'DBMS_LOB.FILEOPEN(v_bfile, DBMS_LOB.FILE_READONLY)',
      )
      expect(odbDbmsLob.fileClose('v_bfile')).toBe('DBMS_LOB.FILECLOSE(v_bfile)')
      expect(odbDbmsLob.fileCloseAll()).toBe('DBMS_LOB.FILECLOSEALL')
    })
  })

  describe('constants', () => {
    it('exposes open modes and durations', () => {
      expect(odbDbmsLob.LOB_READONLY.toSQL()).toBe('DBMS_LOB.LOB_READONLY')
      expect(odbDbmsLob.LOB_READWRITE.toSQL()).toBe('DBMS_LOB.LOB_READWRITE')
      expect(odbDbmsLob.FILE_READONLY.toSQL()).toBe('DBMS_LOB.FILE_READONLY')
      expect(odbDbmsLob.LOBMAXSIZE.toSQL()).toBe('DBMS_LOB.LOBMAXSIZE')
      expect(odbDbmsLob.SESSION.toSQL()).toBe('DBMS_LOB.SESSION')
      expect(odbDbmsLob.CALL.toSQL()).toBe('DBMS_LOB.CALL')
    })
  })
})
