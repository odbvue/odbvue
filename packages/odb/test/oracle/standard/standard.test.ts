import { describe, expect, expectTypeOf, it } from 'vitest'
import { odbOracle } from '../../../src/oracle/standard/standard.js'
import { odbDbmsCrypto } from '../../../src/oracle/dbms-crypto/dbms-crypto.js'
import { cond, odbLiteral, Param, type PlsqlExpression } from '../../../src/schema/attribute.js'

describe('odbOracle', () => {
  it('counts rows or non-null expression values, including conditional aggregates', () => {
    const count = odbOracle.count()
    expectTypeOf(count).toEqualTypeOf<PlsqlExpression<'NUMBER'>>()
    expect(count.type).toBe('NUMBER')
    expect(count.toSQL()).toBe('COUNT(*)')
    expect(odbOracle.count('issuer').toSQL()).toBe('COUNT(issuer)')
    expect(odbOracle.count(odbLiteral(0)).toSQL()).toBe('COUNT(0)')
    expect(odbOracle.count(odbOracle.null()).toSQL()).toBe('COUNT(NULL)')
    const conditionalCount = odbOracle.count(
      odbOracle.caseWhen(
        cond.eq(new Param('p_issuer', 'VARCHAR2'), "provider's name"),
        odbLiteral(1),
        odbOracle.null(),
        'NUMBER',
      ),
    )
    expectTypeOf(conditionalCount).toEqualTypeOf<PlsqlExpression<'NUMBER'>>()
    expect(conditionalCount.toSQL()).toBe(
      "COUNT(CASE WHEN p_issuer = 'provider''s name' THEN 1 ELSE NULL END)",
    )
  })

  it('renders typed context expressions with optional literal or expression lengths', () => {
    const context = odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('CURRENT_USER'))
    expectTypeOf(context).toEqualTypeOf<PlsqlExpression<'VARCHAR2'>>()
    expect(context.type).toBe('VARCHAR2')
    expect(context.toSQL()).toBe("SYS_CONTEXT('USERENV', 'CURRENT_USER')")
    expect(
      odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('CLIENT_IDENTIFIER'), 4000).toSQL(),
    ).toBe("SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER', 4000)")
    expect(odbOracle.sysContext('p_namespace', 'p_parameter', 'p_length').toSQL()).toBe(
      'SYS_CONTEXT(p_namespace, p_parameter, p_length)',
    )
    expect(
      odbOracle.sysContext(odbLiteral("app's context"), odbLiteral('attribute'), 0).toSQL(),
    ).toBe("SYS_CONTEXT('app''s context', 'attribute', 0)")
    expect(odbOracle.lower(context).toSQL()).toBe("LOWER(SYS_CONTEXT('USERENV', 'CURRENT_USER'))")
  })

  it('renders numeric truncation with optional precision without dropping zero', () => {
    const truncated = odbOracle.trunc(new Param('p_port', 'NUMBER'))
    expectTypeOf(truncated).toEqualTypeOf<PlsqlExpression<'NUMBER'>>()
    expect(truncated.type).toBe('NUMBER')
    expect(truncated.toSQL()).toBe('TRUNC(p_port)')
    expect(odbOracle.trunc(12.345, 2).toSQL()).toBe('TRUNC(12.345, 2)')
    expect(odbOracle.trunc(-12.345, 0).toSQL()).toBe('TRUNC(-12.345, 0)')
    expect(odbOracle.trunc(1234, -2).toSQL()).toBe('TRUNC(1234, -2)')
    expect(odbOracle.trunc('p_value', new Param('p_places', 'PLS_INTEGER')).toSQL()).toBe(
      'TRUNC(p_value, p_places)',
    )
    expect(odbOracle.trunc(odbOracle.toNumber('p_value')).toSQL()).toBe('TRUNC(TO_NUMBER(p_value))')
  })

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
