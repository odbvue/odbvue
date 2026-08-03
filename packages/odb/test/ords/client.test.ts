import { describe, expect, it } from 'vitest'
import { generateOrdsClient } from '../../src/ords-client.js'
import { odbPackage } from '../../src/schema/package.js'
import { defineMigration } from '../../src/migration.js'

const appPackage = odbPackage('PCK_APP', (p) => {
  p.procedure('me', (proc) => {
    proc.out('P_VERSION', 'VARCHAR2')
    proc.out('P_VERSION_BASE64', 'CLOB')
    proc.service({ method: 'GET', path: '/auth/me', summary: 'Current app version' })
  })

  p.procedure('POST_LOGIN', (proc) => {
    proc.in('P_USERNAME', 'VARCHAR2')
    proc.out('P_TOKEN', 'VARCHAR2')
    proc.service({ method: 'POST', path: '/auth/login' })
  })
})

describe('Package.ordsEndpoints', () => {
  it('returns one endpoint per procedure with a service', () => {
    const endpoints = appPackage.ordsEndpoints()
    expect(endpoints.map((e) => e.procedureName)).toEqual(['me', 'POST_LOGIN'])
  })
})

describe('MigrationBuilder.ordsEndpoints', () => {
  it('collects endpoints from installed service artifacts', () => {
    const migration = defineMigration('20260101000000_app', { schema: 'APP' }).install(appPackage)
    expect(migration.ordsEndpoints().map((e) => e.procedureName)).toEqual(['me', 'POST_LOGIN'])
  })
})

describe('generateOrdsClient', () => {
  const ts = generateOrdsClient(appPackage.ordsEndpoints())

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
})
