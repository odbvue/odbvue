import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { odbAcl, odbAclPackage, aclTypes } from '../../../src/capabilities/acl/index.js'
import { odbLiteral } from '../../../src/schema/attribute.js'
import { generateApplicationOpenApi } from '../../../src/application.js'
import { compileApplicationEndpoints, type Package } from '../../../src/schema/package.js'
import * as capabilities from '../../../src/capabilities/index.js'

describe('Network ACL capability', () => {
  const sql = odbAcl.toSQLUp({ schema: 'APP' })

  it('exports an installable capability and reusable parameter types', () => {
    expect(capabilities.odbAcl).toBe(odbAcl)
    expect(capabilities.odbAclPackage).toBe(odbAclPackage)
    expect(odbAcl.types).toBe(aclTypes)
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_acl AS')
    expect(sql).not.toContain('CREATE TABLE')
    expect(sql).not.toContain('odb_http')
  })

  it('installs direct privileges before compiling the definer-rights package', () => {
    expect(sql.indexOf('GRANT EXECUTE ON SYS.DBMS_NETWORK_ACL_ADMIN TO APP;')).toBeLessThan(
      sql.indexOf('CREATE OR REPLACE PACKAGE'),
    )
    expect(sql.indexOf('GRANT SELECT ON SYS.DBA_HOST_ACES TO APP;')).toBeLessThan(
      sql.indexOf('CREATE OR REPLACE PACKAGE'),
    )
    expect(sql).not.toContain('AUTHID CURRENT_USER')
    expect(() => odbAcl.toSQLUp({ schema: 'APP; DROP USER OTHER' })).toThrow(
      'Invalid Oracle schema',
    )
    expect(odbAcl.toSQLUp()).not.toContain('GRANT EXECUTE')
  })

  it('defaults helper calls to exact ports 443 and 587 and supports numeric or expression ports', () => {
    expect(odbAcl.addHttp('p_host').toSQL()).toBe('odb_acl.add_http(p_host, 443)')
    expect(odbAcl.removeHttp('p_host').toSQL()).toBe('odb_acl.remove_http(p_host, 443)')
    expect(odbAcl.addSmtp('p_host').toSQL()).toBe('odb_acl.add_smtp(p_host, 587)')
    expect(odbAcl.removeSmtp('p_host').toSQL()).toBe('odb_acl.remove_smtp(p_host, 587)')
    expect(odbAcl.addHttp(odbLiteral('api.example.com'), 8443).toSQL()).toBe(
      "odb_acl.add_http('api.example.com', 8443)",
    )
    expect(odbAcl.removeSmtp('p_host', ':port').toSQL()).toBe('odb_acl.remove_smtp(p_host, :port)')
    expect(odbAcl.addSmtp('p_host', 'NULL').toSQL()).toBe('odb_acl.add_smtp(p_host, NULL)')
    expect(sql).toContain("NVL(p_port, 443), 'http', FALSE")
    expect(sql).toContain("NVL(p_port, 587), 'smtp', FALSE")
  })

  it('grants only the protocol privilege, for its owner and exact port', () => {
    expect(sql).toContain(
      "privilege_list => XS$NAME_LIST(p_privilege), principal_name => SYS_CONTEXT('USERENV', 'CURRENT_USER'), principal_type => XS_ACL.PTYPE_DB",
    )
    expect(sql).toContain('lower_port => p_port, upper_port => p_port')
    expect(sql).toContain('host => LOWER(p_host)')
    expect(sql).not.toContain("'connect'")
    expect(sql).not.toContain("'resolve'")
    expect(sql).not.toContain('p_principal')
    expect(sql).not.toContain('COMMIT')
  })

  it('validates ports without rounding fractional values and rejects unsafe hosts', () => {
    expect(sql).toContain('p_port IN NUMBER')
    expect(sql).toContain('p_port < 1 OR p_port > 65535 OR p_port != TRUNC(p_port)')
    expect(sql).toContain('p_host IS NULL OR LENGTH(p_host) > 255')
    expect(sql).toContain("'^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$'")
    expect(sql).toContain('ODB_ERROR|VALIDATION_ERROR|ACL_HOST_INVALID')
    expect(sql).toContain('ODB_ERROR|VALIDATION_ERROR|ACL_PORT_INVALID')
  })

  it('makes removal of absent grants a no-op without touching denies or other principals', () => {
    expect(sql).toContain('IF p_removing = TRUE THEN')
    expect(sql).toContain('IF l_count > 0 THEN')
    expect(sql).toContain("principal = SYS_CONTEXT('USERENV', 'CURRENT_USER')")
    expect(sql).toContain("principal_type = 'DATABASE'")
    expect(sql).toContain("grant_type = 'GRANT' AND inverted_principal = 'NO'")
    expect(sql).toContain('LOWER(privilege) = p_privilege')
    expect(sql).not.toContain('WHEN OTHERS')
  })

  it('lists grant metadata with nullable bounds and leaves ACLs intact on uninstall', () => {
    const statement = odbAcl.list('p_items')
    expect(statement.toSQL()).toBe('odb_acl.list(p_items)')
    expect(statement.cursors?.P_ITEMS?.map((column) => column.name)).toEqual([
      'host',
      'lower_port',
      'upper_port',
      'privilege',
    ])
    expect(
      statement.cursors?.P_ITEMS?.find((column) => column.name === 'lower_port')?.nullable,
    ).toBe(true)
    expect(sql).toContain('SELECT host, lower_port, upper_port, privilege FROM dba_host_aces')
    expect(sql).toContain("LOWER(privilege) = 'http' OR LOWER(privilege) = 'smtp'")
    expect(sql).toContain('ORDER BY host ASC, lower_port ASC, upper_port ASC, privilege ASC')
    const down = odbAcl.toSQLDown({ schema: 'APP' })
    expect(down).toContain('DROP PACKAGE APP.odb_acl')
    expect(down).not.toContain('REMOVE_HOST_ACE')
    expect(down).not.toContain('REVOKE')
  })
})

describe('Sandbox ACL services', () => {
  let sandbox: Package<Record<never, never>>

  beforeAll(async () => {
    vi.stubEnv('ODBVUE_ADB_SCHEMA_USERNAME', 'APP')
    const module = await import('../../../../../apps/db/src/migrations/00000000000001-sandbox.js')
    sandbox = module.sandboxPackage
  })
  afterAll(() => vi.unstubAllEnvs())

  it('exposes all five operations only to administrators', () => {
    const endpoints = compileApplicationEndpoints(sandbox.application())
      .map((endpoint) => endpoint.toNode())
      .filter((endpoint) => endpoint.pattern.startsWith('acl'))
    expect(endpoints).toHaveLength(5)
    for (const endpoint of endpoints) {
      expect(endpoint.auth).toEqual({ roles: ['admin'] })
    }
    const sql = sandbox.toSQLUp()
    expect(sql).toContain('odb_acl.list(p_items)')
    for (const operation of ['add_http', 'remove_http', 'add_smtp', 'remove_smtp']) {
      expect(sql).toContain(`odb_acl.${operation}(p_host, p_port)`)
    }
  })

  it('generates typed list items and optional port query parameters from the real services', () => {
    const document = generateApplicationOpenApi(sandbox.application()) as {
      paths: Record<
        string,
        Record<string, { parameters: Array<{ name: string; required: boolean; in: string }> }>
      >
      components: { schemas: Record<string, { properties: Record<string, unknown> }> }
    }
    expect(Object.keys(document.components.schemas.SandboxListAclItemsItem!.properties)).toEqual([
      'host',
      'lowerPort',
      'upperPort',
      'privilege',
    ])
    for (const protocol of ['http', 'smtp']) {
      const path = document.paths[`/sandbox/acl/${protocol}/{host}`]!
      for (const method of ['put', 'delete']) {
        expect(path[method]!.parameters).toContainEqual(
          expect.objectContaining({
            name: 'port',
            in: 'query',
            required: false,
          }),
        )
      }
    }
  })

  it('installs ACL in bootstrap and exposes it through the existing sandbox package', async () => {
    vi.stubEnv('ODBVUE_ADB_SCHEMA_PASSWORD', 'test-schema-password')
    vi.stubEnv('ODBVUE_APP_ADMIN_USERNAME', 'admin')
    vi.stubEnv('ODBVUE_APP_ADMIN_PASSWORD', 'test-admin-password')
    const { migration: bootstrap } =
      await import('../../../../../apps/db/src/migrations/00000000000000-bootstrap.js')
    const { migration } =
      await import('../../../../../apps/db/src/migrations/00000000000001-sandbox.js')
    expect(bootstrap.compile().up().join('\n')).toContain('CREATE OR REPLACE PACKAGE APP.odb_acl')
    expect(bootstrap.compile().down().join('\n')).toContain('DROP PACKAGE APP.odb_acl')
    const compiled = migration.compile()
    expect(compiled.blueGreenObjects).toEqual(['pck_sandbox'])
    const up = compiled.up().join('\n')
    expect(up).toContain('CREATE OR REPLACE PACKAGE APP.PCK_SANDBOX_BLUE')
    expect(up).toContain('odb_acl.list(p_items)')
    expect(up).not.toContain('pck_sandbox_acl')
  })
})
