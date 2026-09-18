import { describe, expect, expectTypeOf, it } from 'vitest'
import type { MigrationApplicationArtifact, MigrationSqlArtifact } from '../../src/migration.js'
import { odbQuery } from '../../src/query/index.js'
import {
  cond,
  expr,
  odbLiteral,
  PlsqlStatement,
  type PlsqlBooleanExpression,
  type PlsqlExpression,
} from '../../src/schema/attribute.js'
import {
  defineService,
  emitApplicationSql,
  odbPackage,
  odbType,
  Procedure,
  ProcedureBody,
} from '../../src/schema/package.js'
import { odbTable } from '../../src/schema/table.js'
describe('odbPackage member typing', () => {
  it('exposes typed package member invokers and rejects unknown members', () => {
    const settings = odbPackage('PCK_SETTINGS', (p) => ({
      getValue: p.func('GET_VALUE', odbType.string(), (fn) => {
        fn.parameters({ in: { key: odbType.string() } })
      }),
      setValue: p.proc(
        'SET_VALUE',
        { in: { key: odbType.string(), value: odbType.string() } },
        () => {},
      ),
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

  it('renders procedure members as typed call statements', () => {
    const settings = odbPackage('PCK_SETTINGS', (p) => ({
      getValue: p.func('GET_VALUE', odbType.string(), (fn) => {
        fn.parameters({ in: { key: odbType.string() } })
      }),
      setValue: p.proc('SET_VALUE', { in: { key: odbType.string() } }, () => {}),
    }))

    const statement = settings.setValue(odbLiteral('APP_VERSION'))
    expect(statement.toSQL()).toBe("PCK_SETTINGS.SET_VALUE('APP_VERSION')")
    expectTypeOf(statement).toEqualTypeOf<PlsqlStatement>()
  })

  it('is compatible with migration artifact interfaces', () => {
    const settings = odbPackage('PCK_SETTINGS', (p) => ({
      getValue: p.func('GET_VALUE', odbType.string(), (fn) => {
        fn.parameters({ in: { key: odbType.string() } })
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

describe('Procedure ORDS contracts', () => {
  it('declares a procedure with proc() and direct typed service bindings', () => {
    const pkg = odbPackage('PCK_API', (p) => {
      const login = p.proc(
        'LOGIN',
        {
          in: { username: odbType.string() },
          out: { token: odbType.string() },
        },
        ({ params, body }) => body.set(params.token, params.username),
      )
      defineService(login, {
        method: 'POST',
        path: '/login',
        body: { username: login.parameters.username },
        response: { token: login.parameters.token },
      })
      return { login }
    })

    expect(pkg.application().procedures[0].service?.params?.body?.username.name).toBe('p_username')
    expect(pkg.toSQLUp()).toContain(
      'PROCEDURE LOGIN(p_username IN VARCHAR2, p_token OUT VARCHAR2);',
    )
  })

  it('inherits a package base path while allowing service overrides', () => {
    const pkg = odbPackage('PCK_AUTH', { basePath: '/auth' }, (p) => {
      const login = p.proc('LOGIN', { in: { username: odbType.string() } }, () => {})
      defineService(login, {
        method: 'POST',
        path: '/login',
        body: { username: login.parameters.username },
      })

      const health = p.proc('HEALTH', {}, () => {})
      defineService(health, {
        method: 'GET',
        path: '/health',
        basePath: '/internal',
      })
    })

    expect(pkg.application().procedures.map((procedure) => procedure.service?.basePath)).toEqual([
      'auth/',
      'internal/',
    ])
  })

  it('binds a procedure through direct parameter references', () => {
    const pkg = odbPackage('PCK_API', (p) => {
      const login = p.proc(
        'LOGIN',
        { in: { username: odbType.string() }, out: { token: odbType.string() } },
        ({ params, body }) => body.set(params.token, 'issued'),
      )
      defineService(login, {
        method: 'POST',
        path: '/login',
        body: { username: login.parameters.username },
        response: { token: login.parameters.token },
      })
      return { login }
    })

    expect(pkg.application().procedures[0].service?.params?.body?.username.name).toBe('p_username')
  })

  it('requires every parameter to have one direction-compatible binding', () => {
    expect(() =>
      odbPackage('PCK_API', (p) => {
        const login = p.proc(
          'LOGIN',
          { in: { username: odbType.string() }, out: { token: odbType.string() } },
          () => {},
        )
        defineService(login, {
          method: 'POST',
          path: '/login',
          body: { username: login.parameters.username },
        })
      }),
    ).toThrow('parameter p_token is not bound')
  })

  it('accepts complete route, request, and response bindings', () => {
    expect(() =>
      odbPackage('PCK_API', (p) => {
        const getUser = p.proc(
          'GET_USER',
          { in: { userId: odbType.string() }, out: { result: odbType.string() } },
          () => {},
        )
        defineService(getUser, {
          method: 'GET',
          path: '/users/:id',
          uri: { id: getUser.parameters.userId },
          response: { result: getUser.parameters.result },
        })
      }),
    ).not.toThrow()
  })
})

describe('private package members', () => {
  it('emits private members in the body and supports local typed calls', () => {
    const pkg = odbPackage('PCK_PRIVATE', (p) => {
      const normalize = p.privateFunc('NORMALIZE', odbType.string(), (fn) => {
        const { value } = fn.parameters({ in: { value: odbType.string() } })
        fn.body((body) => body.return(value))
      })
      p.func('PUBLIC_VALUE', odbType.string(), (fn) => {
        fn.body((body) => body.return(normalize.invoke(odbLiteral('value'))))
      })
    })

    const sql = pkg.toSQLUp()
    expect(sql).not.toContain('FUNCTION NORMALIZE(p_value IN VARCHAR2);')
    expect(sql).toContain('FUNCTION NORMALIZE(p_value IN VARCHAR2) RETURN VARCHAR2 IS')
    expect(sql).toContain("RETURN NORMALIZE('value');")
  })

  it('emits private constants from required escaped substitutions', () => {
    const pkg = odbPackage('PCK_PRIVATE', (p) => {
      const secret = p.privateConstant('c_secret', odbType.string(), 'secret')
      p.func('PUBLIC_VALUE', odbType.string(), (fn) => fn.body((body) => body.return(secret)))
    })

    expect(() => pkg.toSQLUp()).toThrow('missing substitution secret')
    const sql = pkg.toSQLUp({ substitutions: { secret: "don's secret" } })
    expect(sql).toContain("c_secret CONSTANT VARCHAR2(32767) := 'don''s secret';")
    expect(sql).not.toContain('c_secret CONSTANT VARCHAR2(32767);')
    expect(sql).toContain('RETURN c_secret;')
  })
})

describe('function parameters', () => {
  it('derives named IN parameter names and column anchored types', () => {
    const users = odbTable('APP_USERS', (t) => ({ id: t.guid().primaryKey() }))
    const pkg = odbPackage('PCK_USERS', (p) => {
      p.func('GET_USER', odbType.string(), (fn) => {
        const { userId, name } = fn.parameters({
          in: { userId: users.id, name: odbType.string(128) },
        })
        expect(userId.name).toBe('p_user_id')
        expect(name.name).toBe('p_name')
        fn.body((body) => body.return(name))
      })
    })

    expect(pkg.toSQLUp()).toContain(
      'FUNCTION GET_USER(p_user_id IN APP_USERS.id%TYPE, p_name IN VARCHAR2) RETURN VARCHAR2;',
    )
  })

  it('has an explicit escape hatch for database-specific types', () => {
    const pkg = odbPackage('PCK_USERS', (p) => {
      p.func('NORMALIZE', odbType.custom('APP_USER_ID'), (fn) => {
        fn.parameters({ in: { userId: odbType.custom('APP_USER_ID') } })
      })
    })

    expect(pkg.toSQLUp()).toContain(
      'FUNCTION NORMALIZE(p_user_id IN APP_USER_ID) RETURN APP_USER_ID;',
    )
  })
})

describe('ProcedureBody control flow and exceptions', () => {
  const bodyLines = (build: (proc: import('../../src/schema/package.js').Procedure) => void) => {
    const procedure = new Procedure('DO_IT')
    build(procedure)
    return emitApplicationSql({
      kind: 'package',
      name: 'PCK_TEST',
      procedures: [procedure.toNode()],
      functions: [],
    })
  }

  it('renders typed, composable conditions and value expressions', () => {
    const body = new ProcedureBody()
    const { hash, userId, startedAt } = body.variables({
      hash: odbType.string(128),
      userId: odbType.guid(),
      startedAt: odbType.timestamp(),
    })
    const validHash = cond.regexpLike(hash, "^a'b$")

    expect(validHash.toSQL()).toBe("REGEXP_LIKE(l_hash, '^a''b$')")
    expect(validHash.not().or(cond.isNull(userId)).toSQL()).toBe(
      "(NOT (REGEXP_LIKE(l_hash, '^a''b$')) OR l_user_id IS NULL)",
    )
    expect(expr.add(startedAt, expr.interval(60, 'SECOND')).toSQL()).toBe(
      "l_started_at + NUMTODSINTERVAL(60, 'SECOND')",
    )
    expect(expr.jsonObject({ subject: userId, active: true }).toSQL()).toBe(
      "JSON_OBJECT('subject' VALUE l_user_id, 'active' VALUE TRUE RETURNING CLOB)",
    )
    expectTypeOf(validHash).toEqualTypeOf<PlsqlBooleanExpression>()
  })

  it('emits an IF/ELSE block with nested statements', () => {
    const sql = bodyLines((proc) => {
      const { result } = proc.parameters({ out: { result: odbType.string() } })
      proc.body((body) => {
        const { status } = body.variables({ status: odbType.integer() })
        body.ifThen(
          cond.eq(status, 200),
          (t) => t.set(result, 'ok'),
          (e) => e.set(result, 'fail'),
        )
      })
    })

    expect(sql).toContain('IF l_status = 200 THEN')
    expect(sql).toContain("      p_result := 'ok';")
    expect(sql).toContain('    ELSE')
    expect(sql).toContain("      p_result := 'fail';")
    expect(sql).toContain('    END IF;')
  })

  it('emits ELSIF, WHILE, CASE, and local subprograms', () => {
    const sql = bodyLines((proc) => {
      const { result } = proc.parameters({ out: { result: odbType.string() } })
      proc.body((body) => {
        const { count } = body.variables({ count: odbType.integer() })
        const normalize = body.localFunc('NORMALIZE', odbType.string(), (fn) => {
          const { value } = fn.parameters({ in: { value: odbType.string() } })
          fn.body((local) => local.return(value))
        })
        const reset = body.localProc('RESET', (local) =>
          local.body((nested) => nested.set(count, 0)),
        )
        body
          .ifThen(cond.eq(count, 0), (then) => then.set(result, 'empty'))
          .elsif(cond.lt(count, 3), (then) => then.set(result, 'small'))
        body.while(cond.lt(count, 10), (loop) => loop.set(count, 10))
        body.case((cases) =>
          cases
            .when(cond.eq(count, 10), (branch) => branch.set(result, normalize.invoke(result)))
            .else((branch) => branch.call(reset.invoke())),
        )
      })
    })

    expect(sql).toContain('FUNCTION NORMALIZE(p_value IN VARCHAR2) RETURN VARCHAR2 IS')
    expect(sql).toContain('PROCEDURE RESET() IS')
    expect(sql).toContain('ELSIF l_count < 3 THEN')
    expect(sql).toContain('WHILE l_count < 10 LOOP')
    expect(sql).toContain('CASE')
    expect(sql).toContain('WHEN l_count = 10 THEN')
    expect(sql).toContain('END CASE;')
    expect(sql).toContain('RESET();')
  })

  it('derives named input parameter names and column anchored types', () => {
    const users = odbTable('APP_USERS', (t) => ({
      username: t.string('USERNAME').notNull(),
    }))
    const sql = bodyLines((proc) => {
      const { username, retryCount, enabled } = proc.parameters({
        in: {
          username: users.username,
          retryCount: odbType.number(),
          enabled: odbType.boolean(),
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
        inOut: { retryCount: odbType.number() },
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
      proc.body((body) => {
        const { uuid } = body.variables({ uuid: odbType.string() })
        body.ifThen(cond.isNotNull(uuid), (t) => t.auditInfo('logged in'))
      })
    })

    expect(sql).toContain('IF l_uuid IS NOT NULL THEN')
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
      const { result } = proc.parameters({ out: { result: odbType.string() } })
      proc.body((body) => body.set(result, 'ok').whenOthers((h) => h.set(result, 'error')))
    })

    expect(sql).toContain('  EXCEPTION')
    expect(sql).toContain('    WHEN OTHERS THEN')
    expect(sql).toContain("      p_result := 'error';")
  })

  it('emits autonomous transaction procedures and commits', () => {
    const sql = bodyLines((proc) => proc.autonomous().body((body) => body.commit()))

    expect(sql).toContain('PRAGMA AUTONOMOUS_TRANSACTION;')
    expect(sql).toContain('COMMIT;')
  })

  it('hoists locals declared inside nested blocks to the enclosing body', () => {
    const sql = bodyLines((proc) => {
      proc.body((body) => {
        const { one } = body.variables({ one: odbType.integer() })
        body.ifThen(cond.eq(one, 1), (t) => {
          const { inner } = t.variables({ inner: odbType.string(10) })
          t.set(inner, 'x')
        })
      })
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
      const { username } = proc.parameters({ in: { username: users.username } })
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
      const { userId, username } = proc.parameters({
        out: { userId: odbType.number(), username: odbType.string() },
      })
      proc.body((body) =>
        body.query(
          odbQuery().selectFrom(users).select([users.id, users.username]).into(userId, username),
        ),
      )
    })

    expect(sql).toContain('SELECT ID, USERNAME INTO p_user_id, p_username FROM APP_USERS;')
  })
})
