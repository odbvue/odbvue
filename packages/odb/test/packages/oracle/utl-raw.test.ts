import { describe, expect, it } from 'vitest'
import { odbUtlRaw } from '../../../src/packages/oracle/utl-raw.js'
import { odbLiteral } from '../../../src/schema/attribute.js'

describe('odbUtlRaw', () => {
  describe('casts', () => {
    it('castToRaw', () => {
      const e = odbUtlRaw.castToRaw('v_text')
      expect(e.toSQL()).toBe('UTL_RAW.CAST_TO_RAW(v_text)')
      expect(e.type).toBe('RAW')
    })

    it('castToVarchar2', () => {
      const e = odbUtlRaw.castToVarchar2('v_raw')
      expect(e.toSQL()).toBe('UTL_RAW.CAST_TO_VARCHAR2(v_raw)')
      expect(e.type).toBe('VARCHAR2')
    })

    it('castToNvarchar2', () => {
      const e = odbUtlRaw.castToNvarchar2('v_raw')
      expect(e.toSQL()).toBe('UTL_RAW.CAST_TO_NVARCHAR2(v_raw)')
      expect(e.type).toBe('NVARCHAR2')
    })

    it('castFromNumber accepts a numeric literal', () => {
      const e = odbUtlRaw.castFromNumber(42)
      expect(e.toSQL()).toBe('UTL_RAW.CAST_FROM_NUMBER(42)')
      expect(e.type).toBe('RAW')
    })

    it('castToNumber', () => {
      const e = odbUtlRaw.castToNumber('v_raw')
      expect(e.toSQL()).toBe('UTL_RAW.CAST_TO_NUMBER(v_raw)')
      expect(e.type).toBe('NUMBER')
    })

    it('castFromBinaryInteger with and without endianess', () => {
      expect(odbUtlRaw.castFromBinaryInteger(7).toSQL()).toBe('UTL_RAW.CAST_FROM_BINARY_INTEGER(7)')
      expect(odbUtlRaw.castFromBinaryInteger('v_int', 1).toSQL()).toBe(
        'UTL_RAW.CAST_FROM_BINARY_INTEGER(v_int, 1)',
      )
    })

    it('castToBinaryInteger with endianess', () => {
      const e = odbUtlRaw.castToBinaryInteger('v_raw', 2)
      expect(e.toSQL()).toBe('UTL_RAW.CAST_TO_BINARY_INTEGER(v_raw, 2)')
      expect(e.type).toBe('BINARY_INTEGER')
    })

    it('castFromBinaryDouble / castToBinaryDouble', () => {
      expect(odbUtlRaw.castFromBinaryDouble('v_d').toSQL()).toBe(
        'UTL_RAW.CAST_FROM_BINARY_DOUBLE(v_d)',
      )
      const e = odbUtlRaw.castToBinaryDouble('v_raw', 1)
      expect(e.toSQL()).toBe('UTL_RAW.CAST_TO_BINARY_DOUBLE(v_raw, 1)')
      expect(e.type).toBe('BINARY_DOUBLE')
    })

    it('castFromBinaryFloat / castToBinaryFloat', () => {
      expect(odbUtlRaw.castFromBinaryFloat('v_f', 2).toSQL()).toBe(
        'UTL_RAW.CAST_FROM_BINARY_FLOAT(v_f, 2)',
      )
      const e = odbUtlRaw.castToBinaryFloat('v_raw')
      expect(e.toSQL()).toBe('UTL_RAW.CAST_TO_BINARY_FLOAT(v_raw)')
      expect(e.type).toBe('BINARY_FLOAT')
    })
  })

  describe('endianess constants', () => {
    it('exposes big/little/machine endian', () => {
      expect(odbUtlRaw.BIG_ENDIAN.toSQL()).toBe('UTL_RAW.BIG_ENDIAN')
      expect(odbUtlRaw.LITTLE_ENDIAN.toSQL()).toBe('UTL_RAW.LITTLE_ENDIAN')
      expect(odbUtlRaw.MACHINE_ENDIAN.toSQL()).toBe('UTL_RAW.MACHINE_ENDIAN')
    })

    it('a constant can be passed as the endianess argument', () => {
      expect(odbUtlRaw.castToBinaryInteger('v_raw', odbUtlRaw.LITTLE_ENDIAN).toSQL()).toBe(
        'UTL_RAW.CAST_TO_BINARY_INTEGER(v_raw, UTL_RAW.LITTLE_ENDIAN)',
      )
    })
  })

  describe('length / substring / concat', () => {
    it('length', () => {
      const e = odbUtlRaw.length('v_raw')
      expect(e.toSQL()).toBe('UTL_RAW.LENGTH(v_raw)')
      expect(e.type).toBe('NUMBER')
    })

    it('substr with position only', () => {
      expect(odbUtlRaw.substr('v_raw', 3).toSQL()).toBe('UTL_RAW.SUBSTR(v_raw, 3)')
    })

    it('substr with position and length', () => {
      expect(odbUtlRaw.substr('v_raw', 3, 4).toSQL()).toBe('UTL_RAW.SUBSTR(v_raw, 3, 4)')
    })

    it('concat joins all operands', () => {
      const e = odbUtlRaw.concat('v_a', 'v_b', 'v_c')
      expect(e.toSQL()).toBe('UTL_RAW.CONCAT(v_a, v_b, v_c)')
      expect(e.type).toBe('RAW')
    })

    it('copies', () => {
      expect(odbUtlRaw.copies('v_raw', 3).toSQL()).toBe('UTL_RAW.COPIES(v_raw, 3)')
    })

    it('reverse', () => {
      expect(odbUtlRaw.reverse('v_raw').toSQL()).toBe('UTL_RAW.REVERSE(v_raw)')
    })
  })

  describe('comparison', () => {
    it('compare without pad', () => {
      expect(odbUtlRaw.compare('v_a', 'v_b').toSQL()).toBe('UTL_RAW.COMPARE(v_a, v_b)')
    })

    it('compare with pad', () => {
      expect(odbUtlRaw.compare('v_a', 'v_b', odbLiteral('00')).toSQL()).toBe(
        "UTL_RAW.COMPARE(v_a, v_b, '00')",
      )
    })
  })

  describe('bitwise', () => {
    it('bitAnd', () => {
      expect(odbUtlRaw.bitAnd('v_a', 'v_b').toSQL()).toBe('UTL_RAW.BIT_AND(v_a, v_b)')
    })
    it('bitOr', () => {
      expect(odbUtlRaw.bitOr('v_a', 'v_b').toSQL()).toBe('UTL_RAW.BIT_OR(v_a, v_b)')
    })
    it('bitXor', () => {
      expect(odbUtlRaw.bitXor('v_a', 'v_b').toSQL()).toBe('UTL_RAW.BIT_XOR(v_a, v_b)')
    })
    it('bitComplement', () => {
      expect(odbUtlRaw.bitComplement('v_a').toSQL()).toBe('UTL_RAW.BIT_COMPLEMENT(v_a)')
    })
  })

  describe('charset conversion / ranges', () => {
    it('convert', () => {
      const e = odbUtlRaw.convert('v_raw', odbLiteral('AL32UTF8'), odbLiteral('WE8ISO8859P1'))
      expect(e.toSQL()).toBe("UTL_RAW.CONVERT(v_raw, 'AL32UTF8', 'WE8ISO8859P1')")
      expect(e.type).toBe('RAW')
    })

    it('xrange', () => {
      expect(odbUtlRaw.xrange(odbLiteral('00'), odbLiteral('FF')).toSQL()).toBe(
        "UTL_RAW.XRANGE('00', 'FF')",
      )
    })

    it('translate', () => {
      expect(odbUtlRaw.translate('v_raw', 'v_from', 'v_to').toSQL()).toBe(
        'UTL_RAW.TRANSLATE(v_raw, v_from, v_to)',
      )
    })

    it('transliterate with optional args', () => {
      expect(odbUtlRaw.transliterate('v_raw').toSQL()).toBe('UTL_RAW.TRANSLITERATE(v_raw)')
      expect(odbUtlRaw.transliterate('v_raw', 'v_to', 'v_from', 0).toSQL()).toBe(
        'UTL_RAW.TRANSLITERATE(v_raw, v_to, v_from, 0)',
      )
    })

    it('overlay with all optional args', () => {
      expect(odbUtlRaw.overlay('v_ov', 'v_target').toSQL()).toBe('UTL_RAW.OVERLAY(v_ov, v_target)')
      expect(odbUtlRaw.overlay('v_ov', 'v_target', 2, 4, 0).toSQL()).toBe(
        'UTL_RAW.OVERLAY(v_ov, v_target, 2, 4, 0)',
      )
    })
  })

  it('composes with nested expressions', () => {
    const e = odbUtlRaw.castToVarchar2(odbUtlRaw.substr('v_raw', 1, 4))
    expect(e.toSQL()).toBe('UTL_RAW.CAST_TO_VARCHAR2(UTL_RAW.SUBSTR(v_raw, 1, 4))')
  })
})
