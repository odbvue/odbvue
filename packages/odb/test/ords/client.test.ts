import { describe, expect, it } from 'vitest'
import {
  emitApplicationOrdsSql,
  generateApplicationClient,
  generateApplicationClientModules,
} from '../../src/application.js'
import { generateOrdsClient } from '../../src/ords-client.js'
import { odbQuery } from '../../src/query/index.js'
import { compileApplicationEndpoints, odbPackage } from '../../src/schema/package.js'
import { odbTable } from '../../src/schema/table.js'
import { defineMigration } from '../../src/migration.js'

const appPackage = odbPackage('PCK_APP', (p) => {
  p.proc('me', (proc) => {
    proc.out('P_VERSION', 'VARCHAR2')
    proc.out('P_VERSION_BASE64', 'CLOB')
    proc.service({ method: 'GET', path: '/auth/me', summary: 'Current app version' })
  })

  p.proc('POST_LOGIN', (proc) => {
    proc.in('P_USERNAME', 'VARCHAR2')
    proc.out('P_TOKEN', 'VARCHAR2')
    proc.service({ method: 'POST', path: '/auth/login' })
  })
})

const users = odbTable('users', (table) => ({
  id: table.number('id').primaryKey(),
  userName: table.string('name').notNull(),
  email: table.string('email'),
}))

const usersPackage = odbPackage('PCK_USERS', (p) => {
  p.proc('get_user', (proc) => {
    proc.in('p_id', 'NUMBER')
    const result = proc.out('p_result', 'SYS_REFCURSOR')
    proc.body((body) =>
      body.openFor(
        result,
        odbQuery().selectFrom(users).select([users.id, users.userName, users.email]),
      ),
    )
    proc.service({ method: 'GET', path: '/users/:id' })
  })
})

describe('application services', () => {
  it('returns one endpoint per procedure with a service', () => {
    const endpoints = compileApplicationEndpoints(appPackage.application())
    expect(endpoints.map((e) => e.procedureName)).toEqual(['me', 'POST_LOGIN'])
  })

  it('defines a shared ORDS module once while retaining every template', () => {
    const sql = emitApplicationOrdsSql(appPackage.application())

    expect(sql.match(/ords\.define_module\(/g)).toHaveLength(1)
    expect(sql.match(/ords\.define_template\(/g)).toHaveLength(2)
    expect(sql).toContain("p_pattern     => 'auth/me'")
    expect(sql).toContain("p_pattern     => 'auth/login'")
  })
})

describe('MigrationBuilder.applications', () => {
  it('collects applications from installed service artifacts', () => {
    const migration = defineMigration('20260101000000_app', { schema: 'APP' }).install(appPackage)
    expect(migration.applications()).toEqual([appPackage.application()])
  })
})

describe('generateOrdsClient', () => {
  const ts = generateApplicationClient(appPackage.application())

  it('emits request and response types from IN and OUT params', () => {
    expect(ts).toContain('export type AppMeRequest = Record<string, never>')
    expect(ts).toContain('export interface AppMeResponse {')
    expect(ts).toContain('  version: string')
    expect(ts).toContain('  versionBase64: string')
    expect(ts).toContain('export interface AppPostLoginRequest {')
    expect(ts).toContain('  username: string')
    expect(ts).toContain('export interface AppPostLoginResponse {')
    expect(ts).toContain('  token: string')
  })

  it('emits an operation descriptor map with method and path', () => {
    expect(ts).toContain('export const ordsOperations = {')
    expect(ts).toContain("appMe: { method: 'GET', path: 'app/auth/me' }")
    expect(ts).toContain("appPostLogin: { method: 'POST', path: 'app/auth/login' }")
    expect(ts).toContain(
      '} as const satisfies Record<keyof OrdsOperations, OrdsOperationDescriptor>',
    )
  })

  it('emits an operation type map keyed by operation id', () => {
    expect(ts).toContain('export interface OrdsOperations {')
    expect(ts).toContain('  appMe: { request: AppMeRequest; response: AppMeResponse }')
    expect(ts).toContain(
      '  appPostLogin: { request: AppPostLoginRequest; response: AppPostLoginResponse }',
    )
  })

  it('infers a result-set row shape from typed openFor columns', () => {
    const [endpoint] = compileApplicationEndpoints(usersPackage.application())
    const cursorTs = generateOrdsClient([endpoint])

    expect(cursorTs).toContain('export interface UsersGetUserResultItem {')
    expect(cursorTs).toContain('  id: number')
    expect(cursorTs).toContain('  name: string')
    expect(cursorTs).toContain('  email: string | null')
    expect(cursorTs).toContain('  result: UsersGetUserResultItem[]')
    expect(cursorTs).toContain("usersGetUser: { method: 'GET', path: 'users/users/:id' }")
    expect(endpoint.toNode().params.find((param) => param.name === 'id')?.sourceType).toBe('URI')
  })
})

describe('generateOrdsClientModules', () => {
  it('emits one file per module and a namespace barrel', () => {
    const generated = generateApplicationClientModules([
      appPackage.application(),
      usersPackage.application(),
    ])

    expect([...generated.files.keys()]).toEqual(['app.ts', 'users.ts'])
    expect(generated.files.get('app.ts')).toContain('appMe')
    expect(generated.files.get('users.ts')).toContain('usersGetUser')
    expect(generated.index).toContain("export * as app from './app.js'")
    expect(generated.index).toContain("export * as users from './users.js'")
  })
})
