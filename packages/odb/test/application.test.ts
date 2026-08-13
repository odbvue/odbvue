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
    proc.in('P_ID', 'NUMBER')
    const result = proc.out('R_RESULT', 'SYS_REFCURSOR')
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
    proc.in('P_BODY', 'CLOB')
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
      sql: 'OPEN R_RESULT FOR SELECT ID, UUID, CREATED_AT, EMAIL FROM APP_USERS',
    })
    expect(procedure.body?.resultSets?.R_RESULT).toEqual([
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
