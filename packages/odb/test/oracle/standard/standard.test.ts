import { describe, expect, it } from 'vitest'
import { odbOracle } from '../../../src/oracle/standard/standard.js'
import { odbDbmsCrypto } from '../../../src/oracle/dbms-crypto/dbms-crypto.js'
import { odbLiteral } from '../../../src/schema/attribute.js'

describe('odbOracle', () => {
  it('allows absent optional JSON paths without hiding malformed values', () => {
    expect(
      odbOracle
        .jsonValue('l_meta', odbLiteral('$.secret'), {
          length: 1,
          errorOnError: true,
          nullOnEmpty: true,
        })
        .toSQL(),
    ).toBe("JSON_VALUE(l_meta, '$.secret' RETURNING VARCHAR2(1) ERROR ON ERROR NULL ON EMPTY)")
    expect(
      odbOracle
        .jsonValue('l_meta', odbLiteral('$.secret'), {
          nullOnEmpty: true,
        })
        .toSQL(),
    ).toBe("JSON_VALUE(l_meta, '$.secret' NULL ON EMPTY)")
  })
  it('renders a SQL JSON merge-patch expression preserving CLOB output', () => {
    const value = odbOracle.jsonMergePatch('l_meta', odbLiteral('{"secret":"Y"}'))
    expect(value.type).toBe('CLOB')
    expect(value.toSQL()).toBe(`JSON_MERGEPATCH(l_meta, '{"secret":"Y"}' RETURNING CLOB)`)
  })
  it('renders RAW and UUID expressions compositionally', () => {
    const expression = odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid()))
    expect(expression.toSQL()).toBe('LOWER(RAWTOHEX(SYS_GUID()))')
    expect(expression.type).toBe('VARCHAR2')
  })

  it('renders RAW conversion and timestamp expressions', () => {
    expect(odbOracle.hexToRaw(odbLiteral('00000001')).toSQL()).toBe("HEXTORAW('00000001')")
    expect(odbOracle.sysTimestamp().toSQL()).toBe('SYSTIMESTAMP')
  })

  it('renders typed string and numeric functions', () => {
    expect(odbOracle.lower(odbOracle.trim('p_username')).toSQL()).toBe('LOWER(TRIM(p_username))')
    expect(odbOracle.nvl('l_hash', odbLiteral('fallback')).toSQL()).toBe("NVL(l_hash, 'fallback')")
    expect(odbOracle.toNumber('l_value').toSQL()).toBe('TO_NUMBER(l_value)')
  })

  it('renders regular-expression functions with optional arguments', () => {
    expect(
      odbOracle
        .regexpSubstr('p_cookie', odbLiteral('token=([^;]*)'), {
          position: 1,
          occurrence: 1,
          matchParameter: odbOracle.null(),
          subexpression: 1,
        })
        .toSQL(),
    ).toBe("REGEXP_SUBSTR(p_cookie, 'token=([^;]*)', 1, 1, NULL, 1)")
    expect(
      odbOracle.regexpReplace('p_auth', odbLiteral('^Bearer '), odbLiteral(''), 1, 1).toSQL(),
    ).toBe("REGEXP_REPLACE(p_auth, '^Bearer ', '', 1, 1)")
  })

  it('composes with DBMS_CRYPTO expressions', () => {
    expect(odbOracle.rawToHex(odbDbmsCrypto.randomBytes(16)).toSQL()).toBe(
      'RAWTOHEX(DBMS_CRYPTO.RANDOMBYTES(16))',
    )
  })
})
