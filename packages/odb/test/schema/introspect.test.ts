import { describe, expect, it } from 'vitest'
import { generatePackageContract } from '../../src/schema/contract.js'
import {
  generateRowInterface,
  generateTableSource,
  introspectColumnsQuery,
  introspectArgumentsQuery,
  oracleTypeToColumnType,
  packageFromArguments,
  tablesFromColumns,
  type IntrospectedArgumentRow,
  type IntrospectedColumnRow,
} from '../../src/introspect.js'

describe('oracleTypeToColumnType', () => {
  it('maps Oracle data-dictionary types to ODB column types', () => {
    expect(oracleTypeToColumnType('VARCHAR2', 100)).toBe('string')
    expect(oracleTypeToColumnType('CHAR', 1)).toBe('string')
    expect(oracleTypeToColumnType('NUMBER')).toBe('number')
    expect(oracleTypeToColumnType('DATE')).toBe('date')
    expect(oracleTypeToColumnType('TIMESTAMP(6)')).toBe('timestamp')
    expect(oracleTypeToColumnType('CLOB')).toBe('clob')
    expect(oracleTypeToColumnType('RAW', 16)).toBe('guid')
    expect(oracleTypeToColumnType('RAW', 32)).toBe('string')
  })
})

describe('introspection queries', () => {
  it('builds a bound columns query against ALL_TAB_COLUMNS', () => {
    const { sql, bindings } = introspectColumnsQuery('app_user')
    expect(sql).toContain('FROM all_tab_columns')
    expect(sql).toContain('WHERE owner = :owner')
    expect(sql).toContain('ORDER BY table_name, column_id')
    expect(bindings).toEqual({ owner: 'APP_USER' })
  })

  it('builds a bound arguments query against ALL_ARGUMENTS', () => {
    const { sql, bindings } = introspectArgumentsQuery('app_user')
    expect(sql).toContain('FROM all_arguments')
    expect(sql).toContain('WHERE owner = :owner')
    expect(bindings).toEqual({ owner: 'APP_USER' })
  })
})

const columnRows: IntrospectedColumnRow[] = [
  {
    TABLE_NAME: 'APP_USERS',
    COLUMN_NAME: 'ID',
    DATA_TYPE: 'NUMBER',
    NULLABLE: 'N',
    COLUMN_ID: 1,
  },
  {
    TABLE_NAME: 'APP_USERS',
    COLUMN_NAME: 'USERNAME',
    DATA_TYPE: 'VARCHAR2',
    DATA_LENGTH: 100,
    NULLABLE: 'N',
    COLUMN_ID: 2,
  },
  {
    TABLE_NAME: 'APP_USERS',
    COLUMN_NAME: 'EMAIL',
    DATA_TYPE: 'VARCHAR2',
    DATA_LENGTH: 255,
    NULLABLE: 'Y',
    COLUMN_ID: 3,
  },
]

describe('tablesFromColumns', () => {
  it('groups rows into introspected tables with mapped column types', () => {
    const tables = tablesFromColumns(columnRows)
    expect(tables).toHaveLength(1)
    expect(tables[0].name).toBe('APP_USERS')
    expect(tables[0].columns).toEqual([
      { name: 'ID', type: 'number', nullable: false },
      { name: 'USERNAME', type: 'string', nullable: false, length: 100 },
      { name: 'EMAIL', type: 'string', nullable: true, length: 255 },
    ])
  })
})

describe('generateRowInterface', () => {
  it('emits a TypeScript row interface with nullable unions', () => {
    const [table] = tablesFromColumns(columnRows)
    const ts = generateRowInterface(table)
    expect(ts).toContain('export interface AppUsers {')
    expect(ts).toContain('  id: number')
    expect(ts).toContain('  username: string')
    expect(ts).toContain('  email: string | null')
  })
})

describe('generateTableSource', () => {
  it('emits an odbTable definition scaffold', () => {
    const [table] = tablesFromColumns(columnRows)
    const src = generateTableSource(table)
    expect(src).toContain("export const appUsers = odbTable('APP_USERS', (t) => ({")
    expect(src).toContain("  id: t.number('ID').notNull(),")
    expect(src).toContain("  username: t.string('USERNAME', 100).notNull(),")
    expect(src).toContain("  email: t.string('EMAIL', 255),")
    expect(src).toContain('}))')
  })
})

const argumentRows: IntrospectedArgumentRow[] = [
  {
    PACKAGE_NAME: 'PCK_USERS',
    OBJECT_NAME: 'GET_USER',
    ARGUMENT_NAME: null,
    DATA_TYPE: 'VARCHAR2',
    IN_OUT: 'OUT',
    POSITION: 0,
    SEQUENCE: 1,
  },
  {
    PACKAGE_NAME: 'PCK_USERS',
    OBJECT_NAME: 'GET_USER',
    ARGUMENT_NAME: 'P_ID',
    DATA_TYPE: 'NUMBER',
    IN_OUT: 'IN',
    POSITION: 1,
    SEQUENCE: 2,
  },
  {
    PACKAGE_NAME: 'PCK_USERS',
    OBJECT_NAME: 'CREATE_USER',
    ARGUMENT_NAME: 'P_NAME',
    DATA_TYPE: 'VARCHAR2',
    IN_OUT: 'IN',
    POSITION: 1,
    SEQUENCE: 1,
  },
  {
    PACKAGE_NAME: 'PCK_USERS',
    OBJECT_NAME: 'CREATE_USER',
    ARGUMENT_NAME: 'P_ID',
    DATA_TYPE: 'NUMBER',
    IN_OUT: 'OUT',
    POSITION: 2,
    SEQUENCE: 2,
  },
]

describe('packageFromArguments', () => {
  it('reconstructs a package node with functions and procedures', () => {
    const node = packageFromArguments('PCK_USERS', argumentRows)
    expect(node.name).toBe('PCK_USERS')
    expect(node.functions.map((f) => f.name)).toEqual(['GET_USER'])
    expect(node.procedures.map((p) => p.name)).toEqual(['CREATE_USER'])

    const contract = generatePackageContract(node)
    expect(contract).toContain('  getUser(input: { id: number }): Promise<string>')
    expect(contract).toContain('  createUser(input: { name: string }): Promise<{ id: number }>')
  })
})
