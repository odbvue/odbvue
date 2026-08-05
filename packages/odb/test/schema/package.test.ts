import { describe, expect, expectTypeOf, it } from 'vitest'
import type { MigrationApplicationArtifact, MigrationSqlArtifact } from '../../src/migration.js'
import { odbLiteral, type PlsqlExpression } from '../../src/schema/attribute.js'
import { odbPackage } from '../../src/schema/package.js'

describe('odbPackage member typing', () => {
  it('exposes typed package member invokers and rejects unknown members', () => {
    const settings = odbPackage('PCK_SETTINGS', (p) => ({
      getValue: p.func('GET_VALUE', 'VARCHAR2', (fn) => {
        fn.in('P_KEY', 'VARCHAR2')
      }),
      setValue: p.proc('SET_VALUE', (proc) => {
        proc.in('P_KEY', 'VARCHAR2')
        proc.in('P_VALUE', 'VARCHAR2')
      }),
    }))

    const value = settings.getValue(odbLiteral('APP_VERSION'))
    expect(value.toSQL()).toBe("PCK_SETTINGS.GET_VALUE('APP_VERSION')")
    expectTypeOf(value).toEqualTypeOf<PlsqlExpression<'VARCHAR2'>>()

    const viaCall = settings.call('getValue', odbLiteral('APP_VERSION'))
    expectTypeOf(viaCall).toEqualTypeOf<PlsqlExpression<'VARCHAR2'>>()

    // @ts-expect-error unknown members should not be accepted
    expect(() => settings.call('does_not_exist', odbLiteral('APP_VERSION'))).toThrow()

    // @ts-expect-error invalid argument types should be rejected
    settings.getValue(123)
  })

  it('rejects procedure members passed to call()', () => {
    const settings = odbPackage('PCK_SETTINGS', (p) => ({
      getValue: p.func('GET_VALUE', 'VARCHAR2', (fn) => {
        fn.in('P_KEY', 'VARCHAR2')
      }),
      setValue: p.proc('SET_VALUE', (proc) => {
        proc.in('P_KEY', 'VARCHAR2')
      }),
    }))

    expect(() => settings.call('setValue' as never, odbLiteral('APP_VERSION'))).toThrow(
      'Package member setValue is not a function',
    )
  })

  it('is compatible with migration artifact interfaces', () => {
    const settings = odbPackage('PCK_SETTINGS', (p) => ({
      getValue: p.func('GET_VALUE', 'VARCHAR2', (fn) => {
        fn.in('P_KEY', 'VARCHAR2')
      }),
    }))

    const sqlArtifact: MigrationSqlArtifact = settings
    const applicationArtifact: MigrationApplicationArtifact = settings

    expectTypeOf(sqlArtifact.toSQLUp()).toEqualTypeOf<string>()
    expectTypeOf(applicationArtifact.application()).toEqualTypeOf<
      ReturnType<typeof settings.application>
    >()
  })
})
