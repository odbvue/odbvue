import { describe, expect, it } from 'vitest'
import { odbUtlEncode } from '../../../src/packages/oracle/utl-encode.js'
import { odbLiteral } from '../../../src/schema/attribute.js'

describe('odbUtlEncode', () => {
  describe('base64', () => {
    it('base64Encode → RAW', () => {
      const e = odbUtlEncode.base64Encode('v_raw')
      expect(e.toSQL()).toBe('UTL_ENCODE.BASE64_ENCODE(v_raw)')
      expect(e.type).toBe('RAW')
    })

    it('base64Decode → RAW', () => {
      expect(odbUtlEncode.base64Decode('v_raw').toSQL()).toBe('UTL_ENCODE.BASE64_DECODE(v_raw)')
    })
  })

  describe('quoted-printable', () => {
    it('quotedPrintableEncode', () => {
      expect(odbUtlEncode.quotedPrintableEncode('v_raw').toSQL()).toBe(
        'UTL_ENCODE.QUOTED_PRINTABLE_ENCODE(v_raw)',
      )
    })

    it('quotedPrintableDecode', () => {
      expect(odbUtlEncode.quotedPrintableDecode('v_raw').toSQL()).toBe(
        'UTL_ENCODE.QUOTED_PRINTABLE_DECODE(v_raw)',
      )
    })
  })

  describe('uuencode', () => {
    it('uuEncode with only the raw argument', () => {
      expect(odbUtlEncode.uuEncode('v_raw').toSQL()).toBe('UTL_ENCODE.UUENCODE(v_raw)')
    })

    it('uuEncode with all optional arguments', () => {
      expect(
        odbUtlEncode.uuEncode('v_raw', 1, odbLiteral('file.txt'), odbLiteral('0')).toSQL(),
      ).toBe("UTL_ENCODE.UUENCODE(v_raw, 1, 'file.txt', '0')")
    })

    it('uuDecode', () => {
      expect(odbUtlEncode.uuDecode('v_raw').toSQL()).toBe('UTL_ENCODE.UUDECODE(v_raw)')
    })
  })

  describe('charset-aware text', () => {
    it('textEncode with encoding constant → VARCHAR2', () => {
      const e = odbUtlEncode.textEncode('v_buf', odbLiteral('WE8ISO8859P1'), odbUtlEncode.BASE64)
      expect(e.toSQL()).toBe("UTL_ENCODE.TEXT_ENCODE(v_buf, 'WE8ISO8859P1', UTL_ENCODE.BASE64)")
      expect(e.type).toBe('VARCHAR2')
    })

    it('textDecode with only the buffer', () => {
      expect(odbUtlEncode.textDecode('v_buf').toSQL()).toBe('UTL_ENCODE.TEXT_DECODE(v_buf)')
    })

    it('mimeheaderEncode', () => {
      expect(
        odbUtlEncode.mimeheaderEncode('v_buf', undefined, odbUtlEncode.QUOTED_PRINTABLE).toSQL(),
      ).toBe('UTL_ENCODE.MIMEHEADER_ENCODE(v_buf, UTL_ENCODE.QUOTED_PRINTABLE)')
    })

    it('mimeheaderDecode', () => {
      expect(odbUtlEncode.mimeheaderDecode('v_buf').toSQL()).toBe(
        'UTL_ENCODE.MIMEHEADER_DECODE(v_buf)',
      )
    })
  })

  describe('constants', () => {
    it('exposes BASE64 and QUOTED_PRINTABLE', () => {
      expect(odbUtlEncode.BASE64.toSQL()).toBe('UTL_ENCODE.BASE64')
      expect(odbUtlEncode.QUOTED_PRINTABLE.toSQL()).toBe('UTL_ENCODE.QUOTED_PRINTABLE')
    })
  })
})
