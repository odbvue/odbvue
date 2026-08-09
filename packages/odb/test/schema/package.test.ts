import { describe, expect, expectTypeOf, it } from 'vitest'
import type { MigrationApplicationArtifact, MigrationSqlArtifact } from '../../src/migration.js'
import { odbLiteral, type PlsqlExpression } from '../../src/schema/attribute.js'
import { odbPackage } from '../../src/schema/package.js'
import { odbTable } from '../../src/schema/table.js'
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

describe('ProcedureBody control flow and exceptions', () => {
  const bodyLines = (build: (proc: import('../../src/schema/package.js').Procedure) => void) => {
    const pkg = odbPackage('PCK_TEST', (p) => {
      p.proc('DO_IT', build)
    })
    return pkg.toSQLUp()
  }

  it('emits an IF/ELSE block with nested statements', () => {
    const sql = bodyLines((proc) => {
      proc.out('R_OUT', 'VARCHAR2')
      proc.body((body) =>
        body.ifThen(
          'v_status = 200',
          (t) => t.assign('r_out', odbLiteral('ok')),
          (e) => e.assign('r_out', odbLiteral('fail')),
        ),
      )
    })

    expect(sql).toContain('IF v_status = 200 THEN')
    expect(sql).toContain("      r_out := 'ok';")
    expect(sql).toContain('    ELSE')
    expect(sql).toContain("      r_out := 'fail';")
    expect(sql).toContain('    END IF;')
  })

  it('derives input names and column anchored types', () => {
    const users = odbTable('APP_USERS', (t) => ({
      username: t.string('USERNAME').notNull(),
    }))
    const sql = bodyLines((proc) => {
      const { username, retryCount, enabled } = proc.inputs({
        username: users.username,
        retryCount: 'number',
        enabled: 'boolean',
      })
      expect(username.name).toBe('p_username')
      expect(retryCount.name).toBe('p_retry_count')
      expect(enabled.name).toBe('p_enabled')
    })

    expect(sql).toContain(
      'PROCEDURE DO_IT(p_username IN APP_USERS.USERNAME%TYPE, p_retry_count IN NUMBER, p_enabled IN BOOLEAN);',
    )
  })

  it('emits an IF block without an ELSE branch', () => {
    const sql = bodyLines((proc) => {
      proc.body((body) => body.ifThen('v_uuid IS NOT NULL', (t) => t.auditInfo('logged in')))
    })

    expect(sql).toContain('IF v_uuid IS NOT NULL THEN')
    expect(sql).not.toContain('ELSE')
    expect(sql).toContain('END IF;')
  })

  it('emits an EXCEPTION section with a WHEN OTHERS handler', () => {
    const sql = bodyLines((proc) => {
      proc.out('R_OUT', 'VARCHAR2')
      proc.body((body) =>
        body
          .assign('r_out', odbLiteral('ok'))
          .whenOthers((h) => h.assign('r_out', odbLiteral('error'))),
      )
    })

    expect(sql).toContain('  EXCEPTION')
    expect(sql).toContain('    WHEN OTHERS THEN')
    expect(sql).toContain("      r_out := 'error';")
  })

  it('hoists locals declared inside nested blocks to the enclosing body', () => {
    const sql = bodyLines((proc) => {
      proc.body((body) =>
        body.ifThen('1 = 1', (t) => {
          const v = t.variable('v_inner', 'VARCHAR2', 10)
          t.assign(v, odbLiteral('x'))
        }),
      )
    })

    expect(sql).toContain('    v_inner VARCHAR2(10);')
    expect(sql).toContain('      v_inner := ')
  })

  it('emits a typed insert and preserves body chaining', () => {
    const users = odbTable('APP_USERS', (t) => ({
      username: t.string('USERNAME').notNull(),
      fullname: t.string('FULLNAME').notNull(),
      attempts: t.number('ATTEMPTS').notNull(),
    }))

    const sql = bodyLines((proc) => {
      const username = proc.in('p_username', 'APP_USERS.USERNAME%TYPE')
      proc.body((body) =>
        body
          .insertInto(users, { username, fullname: 'Bootstrap Admin', attempts: 0 })
          .auditInfo('User created', { 'user.name': username }),
      )
    })

    expect(sql).toContain(
      "INSERT INTO APP_USERS (USERNAME, FULLNAME, ATTEMPTS) VALUES (p_username, 'Bootstrap Admin', 0);",
    )
    expect(sql).toContain(
      `odb_audit.info('User created', odb_audit.attributes('user.name', p_username));`,
    )
  })
})
