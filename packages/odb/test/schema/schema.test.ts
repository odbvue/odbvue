import { describe, expect, it } from 'vitest'

import { odbSchema } from '../../src/schema/schema.js'
import { splitSqlStatements } from '../../src/execution/sql.js'

describe('odbSchema', () => {
  it('provisions direct execute and select object grants', () => {
    const schema = odbSchema('APP', 'secret', (definition) => {
      definition.grant('EXECUTE ON SYS.DBMS_NETWORK_ACL_ADMIN')
      definition.grant('SELECT ON SYS.DBA_HOST_ACES')
    })

    expect(schema.toNode().grants).toEqual([
      'EXECUTE ON SYS.DBMS_NETWORK_ACL_ADMIN',
      'SELECT ON SYS.DBA_HOST_ACES',
    ])
    expect(schema.toSQLUp()).toContain('GRANT EXECUTE ON SYS.DBMS_NETWORK_ACL_ADMIN TO APP;')
    expect(schema.toSQLUp()).toContain('GRANT SELECT ON SYS.DBA_HOST_ACES TO APP;')
  })

  it('enables OCI resource principals only when requested', () => {
    const schema = odbSchema('ODB', 'secret', (definition) => definition.enableResourcePrincipal())

    expect(schema.toSQLUp()).toContain('DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL()')
    expect(schema.toSQLUp()).toContain(
      "DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL(username => 'ODB')",
    )
    expect(schema.toSQLUp().indexOf('ENABLE_RESOURCE_PRINCIPAL()')).toBeLessThan(
      schema.toSQLUp().indexOf("ENABLE_RESOURCE_PRINCIPAL(username => 'ODB')"),
    )
    expect(schema.toSQLUp().match(/IF SQLCODE != -20031 THEN RAISE; END IF;/g)).toHaveLength(2)
    const principalStatements = splitSqlStatements(schema.toSQLUp()).filter((statement) =>
      statement.includes('DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL'),
    )
    expect(principalStatements).toHaveLength(2)
    expect(principalStatements[0]).toContain('ENABLE_RESOURCE_PRINCIPAL()')
    expect(principalStatements[1]).toContain("ENABLE_RESOURCE_PRINCIPAL(username => 'ODB')")
    expect(schema.toNode().resourcePrincipalEnabled).toBe(true)
    expect(odbSchema('ODB', 'secret').toSQLUp()).not.toContain('ENABLE_RESOURCE_PRINCIPAL')
  })
})
