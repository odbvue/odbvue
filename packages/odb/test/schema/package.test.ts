import { describe, expect, expectTypeOf, it } from 'vitest'
import type { MigrationApplicationArtifact, MigrationSqlArtifact } from '../../src/migration.js'
import { odbQuery } from '../../src/query/index.js'
import { odbLiteral, PlsqlStatement, type PlsqlExpression } from '../../src/schema/attribute.js'
import { odbPackage, odbType } from '../../src/schema/package.js'
import { odbTable } from '../../src/schema/table.js'
describe('odbPackage member typing', () => {
  it('exposes typed package member invokers and rejects unknown members', () => {
    const settings = odbPackage('PCK_SETTINGS', (p) => ({
      getValue: p.func('GET_VALUE', 'VARCHAR2', (fn) => {
        fn.param('P_KEY', 'VARCHAR2')
      }),
      setValue: p.proc('SET_VALUE', (proc) => {
        proc.parameters({ in: { key: 'VARCHAR2', value: 'VARCHAR2' } })
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
        fn.param('P_KEY', 'VARCHAR2')
      }),
      setValue: p.proc('SET_VALUE', (proc) => {
        proc.parameters({ in: { key: 'VARCHAR2' } })
      }),
    }))

    expect(() => settings.call('setValue' as never, odbLiteral('APP_VERSION'))).toThrow(
      'Package member setValue is not a function',
    )
  })

  it('is compatible with migration artifact interfaces', () => {
    const settings = odbPackage('PCK_SETTINGS', (p) => ({
      getValue: p.func('GET_VALUE', 'VARCHAR2', (fn) => {
        fn.param('P_KEY', 'VARCHAR2')
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
      const result = proc.param('R_OUT', 'VARCHAR2', 'OUT')
      proc.body((body) =>
        body.ifThen(
          'v_status = 200',
          (t) => t.set(result, 'ok'),
          (e) => e.set(result, 'fail'),
        ),
      )
    })

    expect(sql).toContain('IF v_status = 200 THEN')
    expect(sql).toContain("      R_OUT := 'ok';")
    expect(sql).toContain('    ELSE')
    expect(sql).toContain("      R_OUT := 'fail';")
    expect(sql).toContain('    END IF;')
  })

  it('derives named input parameter names and column anchored types', () => {
    const users = odbTable('APP_USERS', (t) => ({
      username: t.string('USERNAME').notNull(),
    }))
    const sql = bodyLines((proc) => {
      const { username, retryCount, enabled } = proc.parameters({
        in: {
          username: users.username,
          retryCount: 'number',
          enabled: 'boolean',
        },
      })
      expect(username.name).toBe('p_username')
      expect(retryCount.name).toBe('p_retry_count')
      expect(enabled.name).toBe('p_enabled')
    })

    expect(sql).toContain(
      'PROCEDURE DO_IT(p_username IN APP_USERS.USERNAME%TYPE, p_retry_count IN NUMBER, p_enabled IN BOOLEAN);',
    )
  })

  it('derives local names and types from columns and descriptors', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.guid().primaryKey(),
      tokenVersion: t.number().notNull(),
    }))
    const sql = bodyLines((proc) => {
      proc.body((body) => {
        const { userId, tokenVersion, refreshToken } = body.variables({
          userId: users.id,
          tokenVersion: users.tokenVersion,
          refreshToken: odbType.string(128),
        })
        expect(userId.name).toBe('l_user_id')
        expect(tokenVersion.name).toBe('l_token_version')
        expect(refreshToken.name).toBe('l_refresh_token')
      })
    })

    expect(sql).toContain('    l_user_id APP_USERS.id%TYPE;')
    expect(sql).toContain('    l_token_version APP_USERS.token_version%TYPE;')
    expect(sql).toContain('    l_refresh_token VARCHAR2(128);')
  })

  it('derives IN, OUT, and IN OUT parameters from named definitions', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.guid().primaryKey(),
    }))
    const sql = bodyLines((proc) => {
      const { userId, result, retryCount } = proc.parameters({
        in: { userId: users.id },
        out: { result: odbType.string(200) },
        inOut: { retryCount: 'number' },
      })
      expect(userId.name).toBe('p_user_id')
      expect(result.name).toBe('p_result')
      expect(retryCount.name).toBe('p_retry_count')
    })

    expect(sql).toContain(
      'PROCEDURE DO_IT(p_user_id IN APP_USERS.id%TYPE, p_result OUT VARCHAR2, p_retry_count IN OUT NUMBER);',
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

  it('emits a typed FOR range with its implicit index', () => {
    const sql = bodyLines((proc) => {
      proc.body((body) => {
        const { total, limit } = body.variables({
          total: odbType.integer(),
          limit: odbType.integer(),
        })
        body.forRange('attempt', 2, limit, (attempt, loop) => {
          expect(attempt.name).toBe('l_attempt')
          loop.set(total, attempt)
        })
      })
    })

    expect(sql).toContain('FOR l_attempt IN 2..l_limit LOOP')
    expect(sql).toContain('l_total := l_attempt;')
    expect(sql).not.toContain('l_attempt PLS_INTEGER;')
    expect(sql).toContain('END LOOP;')
  })

  it('emits typed procedure-call statements', () => {
    const sql = bodyLines((proc) => {
      proc.body((body) => body.call(new PlsqlStatement('pck_job.run(p_id)')))
    })

    expect(sql).toContain('pck_job.run(p_id);')
  })

  it('emits an EXCEPTION section with a WHEN OTHERS handler', () => {
    const sql = bodyLines((proc) => {
      const result = proc.param('R_OUT', 'VARCHAR2', 'OUT')
      proc.body((body) => body.set(result, 'ok').whenOthers((h) => h.set(result, 'error')))
    })

    expect(sql).toContain('  EXCEPTION')
    expect(sql).toContain('    WHEN OTHERS THEN')
    expect(sql).toContain("      R_OUT := 'error';")
  })

  it('emits autonomous transaction procedures and commits', () => {
    const sql = bodyLines((proc) => proc.autonomous().body((body) => body.commit()))

    expect(sql).toContain('PRAGMA AUTONOMOUS_TRANSACTION;')
    expect(sql).toContain('COMMIT;')
  })

  it('hoists locals declared inside nested blocks to the enclosing body', () => {
    const sql = bodyLines((proc) => {
      proc.body((body) =>
        body.ifThen('1 = 1', (t) => {
          const { inner } = t.variables({ inner: odbType.string(10) })
          t.set(inner, 'x')
        }),
      )
    })

    expect(sql).toContain('    l_inner VARCHAR2(10);')
    expect(sql).toContain('      l_inner := ')
  })

  it('assigns compatible JavaScript literals with Oracle quoting', () => {
    const sql = bodyLines((proc) => {
      proc.body((body) => {
        const { text, count, enabled } = body.variables({
          text: odbType.string(10),
          count: odbType.integer(),
          enabled: odbType.boolean(),
        })
        body.set(text, "Ada's version")
        body.set(count, 2)
        body.set(enabled, true)
        body.set(text, null)

        // @ts-expect-error string literals cannot be assigned to integer targets
        body.set(count, 'two')
        // @ts-expect-error number literals cannot be assigned to boolean targets
        body.set(enabled, 1)
      })
    })

    expect(sql).toContain("l_text := 'Ada''s version';")
    expect(sql).toContain('l_count := 2;')
    expect(sql).toContain('l_enabled := TRUE;')
    expect(sql).toContain('l_text := NULL;')
  })

  it('emits a typed insert and preserves body chaining', () => {
    const users = odbTable('APP_USERS', (t) => ({
      username: t.string('USERNAME').notNull(),
      fullname: t.string('FULLNAME').notNull(),
      attempts: t.number('ATTEMPTS').notNull(),
    }))

    const sql = bodyLines((proc) => {
      const username = proc.param('p_username', 'APP_USERS.USERNAME%TYPE')
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

  it('emits SELECT INTO for multiple query targets', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('ID').notNull(),
      username: t.string('USERNAME').notNull(),
    }))
    const sql = bodyLines((proc) => {
      const userId = proc.param('p_user_id', 'NUMBER', 'OUT')
      const username = proc.param('p_username', 'VARCHAR2', 'OUT')
      proc.body((body) =>
        body.query(
          odbQuery().selectFrom(users).select([users.id, users.username]).into(userId, username),
        ),
      )
    })

    expect(sql).toContain('SELECT ID, USERNAME INTO p_user_id, p_username FROM APP_USERS;')
  })
})
