import { describe, expect, it } from 'vitest'
import { generateApplicationOpenApi } from '../src/application.js'
import { CURSOR_PAGE_DEFAULTS as sharedDefaults } from '../src/constants.js'
import { DEFAULT_LIMIT as settingsDefaultLimit } from '../src/capabilities/settings/constants.js'
import { DEFAULT_LIMIT as storageDefaultLimit } from '../src/capabilities/storage/constants.js'
import { CURSOR_PAGE_DEFAULTS, type CursorPageOptions } from '../src/pagination.js'
import { odbQuery } from '../src/query/index.js'
import {
  compileApplicationEndpoints,
  defineService,
  odbPackage,
  odbType,
  type OdbApplication,
  type OdbPackageOptions,
} from '../src/schema/package.js'
import { odbTable } from '../src/schema/table.js'

const records = odbTable('records', (table) => ({
  id: table.guid().primaryKey(),
  createdAt: table.timestamp().notNull(),
  username: table.string(128).notNull(),
  optional: table.string(128),
  score: table.number().notNull(),
}))

function fixture(defaults: OdbPackageOptions = {}, overrides: CursorPageOptions = {}) {
  return odbPackage('pck_pages', defaults, (pkg) => {
    const list = pkg.proc(
      'list',
      {
        in: { after: odbType.json(), limit: odbType.integer(), search: odbType.string(128) },
        out: { items: odbType.resultset() },
      },
      ({ params, body }) =>
        body.openFor(
          params.items,
          odbQuery()
            .selectFrom(records)
            .select([records.id, records.createdAt, records.username])
            .orderBy(records.createdAt, 'desc')
            .orderBy(records.id, 'desc')
            .paginate({ cursor: params.after, limit: params.limit }),
        ),
    )
    defineService(list, {
      auth: 'authenticated',
      method: 'GET',
      path: '/records',
      pagination: overrides,
      query: {
        cursor: list.parameters.after,
        limit: list.parameters.limit,
        search: list.parameters.search,
      },
      response: { items: list.parameters.items },
    })
    return { list }
  })
}

describe('query-owned cursor pagination', () => {
  it('re-exports one immutable shared default without capability-owned pagination dependencies', () => {
    expect(CURSOR_PAGE_DEFAULTS).toBe(sharedDefaults)
    expect(Object.isFrozen(sharedDefaults)).toBe(true)
    expect(settingsDefaultLimit).toBe(sharedDefaults.defaultLimit)
    expect(storageDefaultLimit).toBe(sharedDefaults.defaultLimit)
  })

  it('leaves ordinary typed cursor responses unpaginated without a service flag', () => {
    const pkg = odbPackage('pck_detail', { pagination: { defaultLimit: 50 } }, (builder) => {
      const read = builder.proc(
        'read',
        { out: { items: odbType.resultset() } },
        ({ params, body }) =>
          body.openFor(params.items, odbQuery().selectFrom(records).select([records.id]).limit(1)),
      )
      defineService(read, {
        auth: 'authenticated',
        method: 'GET',
        path: '/record',
        response: { items: read.parameters.items },
      })
    })
    const node = compileApplicationEndpoints(pkg)[0]!.toNode()
    expect(node.cursorPage).toBeUndefined()
    expect(node.source).not.toContain('v_page_next_cursor')
    expect(generateApplicationOpenApi(pkg)).toMatchObject({
      components: {
        schemas: {
          DetailReadResponse: {
            required: ['items'],
            properties: { items: expect.anything() },
          },
        },
      },
    })
  })

  it('requires every component of a composite primary key for stable ordering', () => {
    const composite = odbTable('composite', (table) => ({
      tenant: table.number().primaryKey(),
      sequence: table.number().primaryKey(),
    }))
    const build = (complete: boolean) =>
      odbPackage('pck_composite', (builder) => {
        builder.proc(
          'list',
          {
            in: { after: odbType.json(), limit: odbType.integer() },
            out: { items: odbType.resultset() },
          },
          ({ params, body }) => {
            const query = odbQuery().selectFrom(composite)
            if (complete) query.orderBy(composite.tenant)
            query.orderBy(composite.sequence)
            body.openFor(
              params.items,
              query.paginate({ cursor: params.after, limit: params.limit }),
            )
          },
        )
      })
    expect(() => build(false)).toThrow('unique non-null')
    expect(build(true).toSQLUp()).toContain('ORDER BY tenant ASC, sequence ASC')
  })

  it('derives a composite timestamp/id keyset without looking up the previous row', () => {
    const pkg = fixture()
    const sql = pkg.toSQLUp()
    expect(sql).toContain("created_at < TO_TIMESTAMP(JSON_VALUE(p_after, '$[0]'")
    expect(sql).toContain("created_at = TO_TIMESTAMP(JSON_VALUE(p_after, '$[0]'")
    expect(sql).toContain("id < JSON_VALUE(p_after, '$[1]'")
    expect(sql).toContain(
      'ORDER BY created_at DESC, id DESC FETCH FIRST NVL(p_limit, 25) + 1 ROWS ONLY',
    )
    expect(sql).not.toContain('INTO l_after')
    expect(compileApplicationEndpoints(pkg)[0]?.toNode().cursorPage).toMatchObject({
      ...CURSOR_PAGE_DEFAULTS,
      order: [
        { name: 'created_at', type: 'timestamp', direction: 'desc' },
        { name: 'id', type: 'guid', direction: 'desc' },
      ],
    })
  })

  it('supports mixed ascending/descending order and numeric cursor values', () => {
    const pkg = odbPackage('pck_mixed', (builder) => {
      builder.proc(
        'list',
        {
          in: { after: odbType.json(), limit: odbType.integer() },
          out: { items: odbType.resultset() },
        },
        ({ params, body }) =>
          body.openFor(
            params.items,
            odbQuery()
              .selectFrom(records)
              .select([records.id, records.score])
              .orderBy(records.score)
              .orderBy(records.id, 'desc')
              .paginate({ cursor: params.after, limit: params.limit }),
          ),
      )
    })
    const sql = pkg.toSQLUp()
    expect(sql).toContain("score > JSON_VALUE(p_after, '$[0]' RETURNING NUMBER ERROR ON ERROR)")
    expect(sql).toContain("score = JSON_VALUE(p_after, '$[0]' RETURNING NUMBER ERROR ON ERROR)")
    expect(sql).toContain("id < JSON_VALUE(p_after, '$[1]'")
  })

  it('infers a single primary-key order only when no ordering was declared', () => {
    const pkg = odbPackage('pck_implicit', (builder) => {
      builder.proc(
        'list',
        {
          in: { after: odbType.json(), limit: odbType.integer() },
          out: { items: odbType.resultset() },
        },
        ({ params, body }) =>
          body.openFor(
            params.items,
            odbQuery()
              .selectFrom(records)
              .select([records.id])
              .paginate({ cursor: params.after, limit: params.limit }),
          ),
      )
    })
    expect(pkg.toSQLUp()).toContain('ORDER BY id ASC FETCH FIRST NVL(p_limit, 25) + 1 ROWS ONLY')
  })

  it('encodes the last displayed tuple, not the lookahead row, and omits terminal continuation', () => {
    const source = compileApplicationEndpoints(fixture())[0]!.toNode().source
    const lookahead = source.indexOf('IF v_output_3_array.get_size() >= v_page_limit THEN')
    const append = source.indexOf('v_output_3_array.append')
    const boundary = source.indexOf('SELECT JSON_ARRAY(')
    expect(lookahead).toBeGreaterThan(source.indexOf('EXIT WHEN v_output_3%NOTFOUND'))
    expect(lookahead).toBeLessThan(append)
    expect(boundary).toBeGreaterThan(append)
    expect(source).toContain('SELECT JSON_ARRAY(TO_CHAR(v_output_3_column_1')
    expect(source).toContain('RTRIM(v_output_3_column_0) NULL ON NULL')
    expect(source).toContain("'nextCursor' VALUE v_page_next_cursor ABSENT ON NULL")
    expect(source).toContain('p_limit => v_page_limit')
    expect(source).not.toContain('p_limit => v_page_limit + 1')
    expect(source).toContain('CLOSE v_output_3')
  })

  it('validates token version, query/order/user scope, tuple arity and scalar types before calling the procedure', () => {
    const source = compileApplicationEndpoints(fixture())[0]!.toNode().source
    expect(source).toContain('^v1\\.[0-9a-f]{64}\\.([0-9A-F]{2})+$')
    expect(source).toContain("'subject' VALUE v_auth_user_id")
    expect(source).toContain("'search' VALUE :search")
    expect(source).toContain('"direction":"desc"')
    expect(source).toContain('SUBSTR(v_page_token, 4, 64) <> v_page_scope')
    expect(source).toContain('v_page_keys.get_size() <> 2')
    expect(source).toContain('v_page_key := v_page_keys.get(0)')
    expect(source).toContain('v_page_key.is_string()')
    expect(source).toContain('DEFAULT NULL ON CONVERSION ERROR')
    expect(source).toContain('^[0-9A-Fa-f]{32}$')
    expect(source).toContain('LENGTHB(v_page_boundary) > 1966')
    expect(source.indexOf('CURSOR_INVALID')).toBeLessThan(source.indexOf('pck_pages.list('))
    expect(source).toContain('v_page_limit <> TRUNC(v_page_limit)')
    expect(source).toContain('ODB_HTTP|400|CURSOR_LIMIT_INVALID')
  })

  it('inherits shared and package limits while allowing service overrides', () => {
    const pkg = fixture({ pagination: { defaultLimit: 50, maxLimit: 200 } }, { maxLimit: 150 })
    const node = compileApplicationEndpoints(pkg)[0]!.toNode()
    expect(node.cursorPage).toMatchObject({ defaultLimit: 50, maxLimit: 150 })
    expect(node.source).toContain('v_page_limit := NVL(:limit, 50)')
    expect(node.source).toContain('v_page_limit > 150')
    expect(generateApplicationOpenApi(pkg)).toMatchObject({
      paths: {
        '/pages/records': {
          get: {
            parameters: expect.arrayContaining([
              expect.objectContaining({
                name: 'cursor',
                schema: expect.objectContaining({
                  type: 'string',
                  maxLength: 4000,
                }),
              }),
              expect.objectContaining({
                name: 'limit',
                schema: expect.objectContaining({
                  type: 'integer',
                  minimum: 1,
                  maximum: 150,
                  default: 50,
                }),
              }),
            ]),
            responses: { '400': expect.anything() },
          },
        },
      },
      components: {
        schemas: {
          PagesListResponse: {
            required: ['items'],
            properties: { items: { maxItems: 150 }, nextCursor: { type: 'string' } },
          },
        },
      },
    })
  })

  it.each([
    { defaultLimit: 0 },
    { maxLimit: 0 },
    { defaultLimit: 26, maxLimit: 25 },
    { defaultLimit: 1.5 },
    { maxLimit: Infinity },
  ])('rejects invalid defaults %j', (limits) => {
    expect(() => compileApplicationEndpoints(fixture({}, limits))).toThrow('Cursor page limits')
  })

  it('preserves query metadata through model serialization and delegated calls with renamed inputs', () => {
    const inner = fixture()
    const outer = odbPackage('pck_outer_page', (builder) => {
      const list = builder.proc(
        'list',
        {
          in: { pageAfter: odbType.json(), pageSize: odbType.integer(), term: odbType.string(128) },
          out: { items: odbType.resultset() },
        },
        ({ params, body }) =>
          body.call(inner.list(params.pageAfter, params.pageSize, params.term, params.items)),
      )
      defineService(list, {
        auth: 'authenticated',
        method: 'GET',
        path: '/records',
        query: {
          cursor: list.parameters.pageAfter,
          limit: list.parameters.pageSize,
          search: list.parameters.term,
        },
        response: { items: list.parameters.items },
      })
    })
    const model = JSON.parse(JSON.stringify(outer.application())) as OdbApplication
    const source = compileApplicationEndpoints(model)[0]!.toNode().source
    expect(source).toContain('p_page_after => v_page_after')
    expect(source).toContain('p_page_size => v_page_limit')
    expect(source).toContain('v_page_keys.get_size() <> 2')
  })

  it('rejects nullable ordering and non-unique ordering instead of guessing an ID tie-breaker', () => {
    for (const order of [records.optional, records.createdAt]) {
      expect(() =>
        odbPackage('pck_invalid', (builder) => {
          builder.proc(
            'list',
            { in: { after: odbType.json(), limit: odbType.integer() } },
            ({ params }) =>
              odbQuery()
                .selectFrom(records)
                .orderBy(order)
                .paginate({ cursor: params.after, limit: params.limit }),
          )
        }),
      ).toThrow('unique non-null')
    }
    expect(() =>
      odbPackage('pck_nullable', (builder) => {
        builder.proc(
          'list',
          { in: { after: odbType.json(), limit: odbType.integer() } },
          ({ params }) =>
            odbQuery()
              .selectFrom(records)
              .orderBy(records.optional)
              .orderBy(records.id)
              .paginate({ cursor: params.after, limit: params.limit }),
        )
      }),
    ).toThrow('non-null typed ordering')
  })
})
