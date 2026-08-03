import { describe, expect, it } from 'vitest'
import { generatePackageContract, plsqlToTsType } from '../../src/schema/contract.js'
import { odbPackage } from '../../src/schema/package.js'

describe('generatePackageContract', () => {
  it('maps PL/SQL types to TypeScript types', () => {
    expect(plsqlToTsType('VARCHAR2')).toBe('string')
    expect(plsqlToTsType('CLOB')).toBe('string')
    expect(plsqlToTsType('NUMBER')).toBe('number')
    expect(plsqlToTsType('PLS_INTEGER')).toBe('number')
    expect(plsqlToTsType('BOOLEAN')).toBe('boolean')
    expect(plsqlToTsType('DATE')).toBe('Date')
    expect(plsqlToTsType('TIMESTAMP')).toBe('Date')
    expect(plsqlToTsType('BLOB')).toBe('Buffer')
    expect(plsqlToTsType('SYS_REFCURSOR')).toBe('unknown[]')
    expect(plsqlToTsType('SOME_CUSTOM_TYPE')).toBe('unknown')
  })

  it('generates a function contract with an input object and a Promise return', () => {
    const pkg = odbPackage('PCK_USERS', (p) => {
      p.func('GET_USER', 'VARCHAR2', (fn) => {
        fn.in('P_ID', 'NUMBER')
      })
    })

    const ts = generatePackageContract(pkg)
    expect(ts).toContain('export interface PckUsers {')
    expect(ts).toContain('  getUser(input: { id: number }): Promise<string>')
    expect(ts).toContain('}')
  })

  it('generates a procedure contract with OUT params as the response shape', () => {
    const pkg = odbPackage('PCK_USERS', (p) => {
      p.procedure('CREATE_USER', (proc) => {
        proc.in('P_NAME', 'VARCHAR2')
        proc.out('P_ID', 'NUMBER')
      })
    })

    const ts = generatePackageContract(pkg)
    expect(ts).toContain('  createUser(input: { name: string }): Promise<{ id: number }>')
  })

  it('omits the input argument when a procedure has no IN parameters', () => {
    const pkg = odbPackage('PCK_APP', (p) => {
      p.procedure('ME', (proc) => {
        proc.out('P_VERSION', 'VARCHAR2')
      })
    })

    const ts = generatePackageContract(pkg)
    expect(ts).toContain('  me(): Promise<{ version: string }>')
  })

  it('returns Promise<void> for a procedure without OUT parameters', () => {
    const pkg = odbPackage('PCK_APP', (p) => {
      p.procedure('PING', (proc) => {
        proc.in('P_MESSAGE', 'VARCHAR2')
      })
    })

    const ts = generatePackageContract(pkg)
    expect(ts).toContain('  ping(input: { message: string }): Promise<void>')
  })

  it('treats IN OUT parameters as both input and response fields', () => {
    const pkg = odbPackage('PCK_COUNTER', (p) => {
      p.procedure('BUMP', (proc) => {
        proc.inOut('P_VALUE', 'NUMBER')
      })
    })

    const ts = generatePackageContract(pkg)
    expect(ts).toContain('  bump(input: { value: number }): Promise<{ value: number }>')
  })

  it('allows overriding the generated interface name', () => {
    const pkg = odbPackage('PCK_USERS', (p) => {
      p.func('GET_USER', 'VARCHAR2', (fn) => {
        fn.in('P_ID', 'NUMBER')
      })
    })

    const ts = generatePackageContract(pkg, { interfaceName: 'UsersApi' })
    expect(ts).toContain('export interface UsersApi {')
  })
})
