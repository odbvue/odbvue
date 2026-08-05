import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  columnBuilderMethod,
  emitOracleType,
  emitOrdsType,
  emitTypeScriptType,
  normalizeOracleIdentifier,
  odbTypeFromOracle,
  odbTypeFromOrds,
  odbTypeFromPlsql,
  ordsTypeFromPlsql,
  oracleIdentifierEquals,
  oracleParameterName,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  type OdbValueForType,
} from '../src/model.js'

describe('canonical ODB model', () => {
  it('maps source systems into ODB types', () => {
    expect(odbTypeFromOracle('TIMESTAMP(6)')).toBe('timestamp')
    expect(odbTypeFromOracle('RAW', 16)).toBe('guid')
    expect(odbTypeFromPlsql('SYS_REFCURSOR')).toBe('resultset')
    expect(odbTypeFromOrds('DOUBLE')).toBe('number')
  })

  it('emits target representations from ODB types', () => {
    expect(emitOracleType('string', { length: 80 })).toBe('VARCHAR2(80 CHAR)')
    expect(emitOracleType('guid')).toBe('RAW(16)')
    expect(emitOrdsType('number')).toBe('DOUBLE')
    expect(emitTypeScriptType('timestamp')).toBe('Date')
    expect(emitTypeScriptType('timestamp', 'json')).toBe('string')
    expect(columnBuilderMethod('clob')).toBe('clob')
    expect(ordsTypeFromPlsql('PLS_INTEGER')).toBe('INT')
    expect(ordsTypeFromPlsql('NUMBER')).toBe('STRING')
    expectTypeOf<OdbValueForType<'number'>>().toEqualTypeOf<number>()
  })

  it('normalizes code and Oracle parameter names consistently', () => {
    expect(toPascalCase('APP_USERS')).toBe('AppUsers')
    expect(toCamelCase('APP_USERS')).toBe('appUsers')
    expect(toKebabCase('APP_USERS')).toBe('app-users')
    expect(oracleParameterName('P_USER_ID')).toBe('userId')
    expect(oracleParameterName('R_USER_ID', { style: 'kebab' })).toBe('user-id')
  })

  it('handles quoted and unquoted Oracle identifiers', () => {
    expect(normalizeOracleIdentifier(' app_users ')).toBe('APP_USERS')
    expect(normalizeOracleIdentifier('"AppUsers"')).toBe('AppUsers')
    expect(oracleIdentifierEquals('app_users', 'APP_USERS')).toBe(true)
    expect(oracleIdentifierEquals('"AppUsers"', 'APPUSERS')).toBe(false)
  })
})
