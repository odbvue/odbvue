import { describe, expect, it } from 'vitest'

import { odbSchema } from '../src/schema/schema.js'
import { splitSqlStatements } from '../src/oracle/execution/sql.js'

describe('odbSchema', () => {
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
