import { describe, expect, it } from 'vitest'
import {
  emitApplicationOrdsSql,
  generateApplication,
  generateApplicationsOpenApi,
  generateApplicationOpenApi,
} from '../src/application.js'
import { odbQuery } from '../src/query/index.js'
import { odbPackage, type OdbApplication } from '../src/schema/package.js'
import { odbTable } from '../src/schema/table.js'

const users = odbTable('APP_USERS', (table) => ({
  id: table.number('ID').primaryKey(),
  uuid: table.guid('UUID').notNull(),
  createdAt: table.timestamp('CREATED_AT').notNull(),
  email: table.string('EMAIL'),
}))

const application = odbPackage('PCK_USERS', (p) => {
  p.proc('GET_USER', (proc) => {
    const { result } = proc.parameters({
      in: { id: 'NUMBER' },
      out: { result: 'SYS_REFCURSOR' },
    })
    proc.body((body) =>
      body.openFor(
        result,
        odbQuery().selectFrom(users).select([users.id, users.uuid, users.createdAt, users.email]),
      ),
    )
    proc.service({ method: 'GET', path: '/users/:id', summary: 'Fetch a user' })
  })

  p.func('COUNT_USERS', 'NUMBER', (fn) => {
    fn.body((body) => body.return(0))
  })

  p.proc('POST_USER', (proc) => {
    proc.parameters({ in: { body: 'CLOB' } })
    proc.service({ method: 'POST', path: '/users' })
  })
})

describe('ODB application contract', () => {
  it('retains implementation and service metadata in one serializable model', () => {
    const model = JSON.parse(JSON.stringify(application.application())) as OdbApplication
    const procedure = model.procedures[0]

    expect(procedure.service).toEqual({
      method: 'GET',
      path: 'users/:id',
      summary: 'Fetch a user',
    })
    expect(procedure.body?.statements[0]).toEqual({
      kind: 'raw',
      sql: 'OPEN p_result FOR SELECT ID, UUID, CREATED_AT, EMAIL FROM APP_USERS',
    })
    expect(procedure.body?.resultSets?.P_RESULT).toEqual([
      { name: 'ID', type: 'number', nullable: false },
      { name: 'UUID', type: 'guid', nullable: false },
      { name: 'CREATED_AT', type: 'timestamp', nullable: false },
      { name: 'EMAIL', type: 'string', nullable: true },
    ])
  })

  it('generates the contract and client directly from a plain application model', () => {
    const model = JSON.parse(JSON.stringify(application.application())) as OdbApplication
    const generated = generateApplication(model)

    expect(generated.plsql).toContain('CREATE OR REPLACE PACKAGE PCK_USERS AS')
    expect(generated.ords).toContain('ords.define_module(')
    expect(generated.contract).toContain('getUser(input: { id: number })')
    expect(generated.contract).toContain('countUsers(): Promise<number>')
    expect(generated.openapi).toMatchObject({ openapi: '3.1.0' })
  })

  it('generates OpenAPI from procedure service metadata', () => {
    const document = generateApplicationOpenApi(application, {
      title: 'Users API',
      version: '2.0.0',
    }) as {
      openapi: string
      info: { title: string; version: string }
      paths: Record<string, Record<string, unknown>>
    }

    expect(document.openapi).toBe('3.1.0')
    expect(document.info).toEqual({ title: 'Users API', version: '2.0.0' })
    expect(document.paths['/users/users/{id}']).toHaveProperty('get')
    expect(document.paths['/users/users']?.post).toMatchObject({
      parameters: [],
      requestBody: { content: { 'application/json': { schema: {} } } },
    })
  })

  it('binds P_BODY to ORDS request content', () => {
    expect(emitApplicationOrdsSql(application)).toContain('p_body => :body')
  })

  it('maps POST inputs from a JSON request body instead of HTTP headers', () => {
    const login = odbPackage('PCK_AUTH', (p) => {
      p.proc('POST_LOGIN', (proc) => {
        proc.parameters({ in: { username: 'VARCHAR2', password: 'VARCHAR2' } })
        proc.service({ method: 'POST', path: '/login' })
      })
    })

    const sql = emitApplicationOrdsSql(login)
    const document = generateApplicationOpenApi(login) as {
      paths: Record<string, Record<string, any>>
    }

    expect(sql).toContain('DECLARE v_body CLOB := :body_text;')
    expect(sql).toContain(
      "p_username => JSON_VALUE(v_body, ''$.username'' RETURNING VARCHAR2(32767))",
    )
    expect(sql).toContain(
      "p_password => JSON_VALUE(v_body, ''$.password'' RETURNING VARCHAR2(32767))",
    )
    expect(sql).not.toContain("p_name               => 'username'")
    expect(sql).not.toContain("p_name               => 'password'")
    expect(document.paths['/auth/login']?.post).toMatchObject({
      parameters: [],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { username: { type: 'string' }, password: { type: 'string' } },
            },
          },
        },
      },
    })
  })

  it('uses identifier-safe bind variables for kebab-case ORDS parameters', () => {
    const output = odbPackage('PCK_OUTPUT', (p) => {
      p.proc('POST_VALUE', (proc) => {
        proc.parameters({ out: { accessToken: 'VARCHAR2' } })
        proc.service({ method: 'POST', path: '/value' })
      })
    })

    const sql = emitApplicationOrdsSql(output)
    expect(sql).toContain('p_access_token => :accessToken')
    expect(sql).toContain("p_name               => 'access-token'")
    expect(sql).toContain("p_bind_variable_name => 'accessToken'")
  })

  it('places typed cursor rows in reusable OpenAPI schemas', () => {
    const document = generateApplicationsOpenApi([application]) as {
      components: { schemas: Record<string, Record<string, any>> }
    }

    expect(document.components.schemas.UsersGetUserResultItem).toMatchObject({
      type: 'object',
      required: ['id', 'uuid', 'createdAt'],
      properties: {
        id: { type: 'number' },
        uuid: { type: 'string', pattern: '^[0-9a-fA-F]{32}$' },
        createdAt: { type: 'string', format: 'date-time' },
        email: { type: ['string', 'null'] },
      },
    })
    expect(document.components.schemas.UsersGetUserResponse).toMatchObject({
      required: ['result'],
      properties: {
        result: {
          type: 'array',
          items: { $ref: '#/components/schemas/UsersGetUserResultItem' },
        },
      },
    })
  })
})
