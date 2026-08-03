import type { CompiledQuery } from './query/ast.js'
import type { ColumnType } from './schema/column.js'
import type { ParamNode, ParameterDirection, PlsqlType } from './schema/attribute.js'
import type { FunctionNode, PackageNode, ProcedureNode } from './schema/package.js'

// ── Raw data-dictionary row shapes ────────────────────────────────────────────

/** A row from `ALL_TAB_COLUMNS` (uppercase keys, as returned by node-oracledb). */
export type IntrospectedColumnRow = {
  TABLE_NAME: string
  COLUMN_NAME: string
  DATA_TYPE: string
  DATA_LENGTH?: number
  NULLABLE: 'Y' | 'N'
  COLUMN_ID?: number
}

/** A row from `ALL_ARGUMENTS` describing one package subprogram argument. */
export type IntrospectedArgumentRow = {
  PACKAGE_NAME: string
  OBJECT_NAME: string
  ARGUMENT_NAME: string | null
  DATA_TYPE: string
  IN_OUT: 'IN' | 'OUT' | 'IN/OUT'
  POSITION: number
  SEQUENCE: number
}

// ── Introspection queries ─────────────────────────────────────────────────────

/** Query `ALL_TAB_COLUMNS` for every column owned by `owner`. */
export function introspectColumnsQuery(owner: string): CompiledQuery {
  const sql = [
    'SELECT table_name, column_name, data_type, data_length, nullable, column_id',
    'FROM all_tab_columns',
    'WHERE owner = :owner',
    'ORDER BY table_name, column_id',
  ].join('\n')
  return { sql, bindings: { owner: owner.toUpperCase() } }
}

/** Query `ALL_ARGUMENTS` for every package subprogram argument owned by `owner`. */
export function introspectArgumentsQuery(owner: string): CompiledQuery {
  const sql = [
    'SELECT package_name, object_name, argument_name, data_type, in_out, position, sequence',
    'FROM all_arguments',
    'WHERE owner = :owner AND package_name IS NOT NULL',
    'ORDER BY package_name, object_name, position',
  ].join('\n')
  return { sql, bindings: { owner: owner.toUpperCase() } }
}

// ── Type mapping ──────────────────────────────────────────────────────────────

/** Map an Oracle data-dictionary type to the nearest ODB column type. */
export function oracleTypeToColumnType(dataType: string, length?: number): ColumnType {
  const type = dataType.toUpperCase()
  if (type.startsWith('TIMESTAMP')) return 'timestamp'
  if (type === 'DATE') return 'date'
  if (type === 'CLOB' || type === 'NCLOB') return 'clob'
  if (type === 'RAW') return length === 16 ? 'guid' : 'string'
  if (type === 'NUMBER' || type === 'FLOAT' || type === 'INTEGER') return 'number'
  if (type.startsWith('VARCHAR') || type.startsWith('NVARCHAR') || type.startsWith('CHAR')) {
    return 'string'
  }
  if (type.startsWith('NCHAR')) return 'string'
  return 'string'
}

/** Normalize an `ALL_ARGUMENTS` data type to a known PL/SQL type where possible. */
function normalizePlsqlType(dataType: string): PlsqlType | string {
  const type = dataType.toUpperCase()
  if (type === 'REF CURSOR') return 'SYS_REFCURSOR'
  if (type === 'PL/SQL BOOLEAN') return 'BOOLEAN'
  return type
}

function normalizeDirection(inOut: IntrospectedArgumentRow['IN_OUT']): ParameterDirection {
  if (inOut === 'IN/OUT') return 'IN OUT'
  return inOut
}

// ── Table reconstruction ──────────────────────────────────────────────────────

export type IntrospectedTableColumn = {
  name: string
  type: ColumnType
  nullable: boolean
  length?: number
}

export type IntrospectedTable = {
  name: string
  columns: IntrospectedTableColumn[]
}

/** Whether a column type carries a meaningful length qualifier for codegen. */
function hasLength(type: ColumnType): boolean {
  return type === 'string'
}

/** Group `ALL_TAB_COLUMNS` rows into introspected tables, preserving column order. */
export function tablesFromColumns(rows: IntrospectedColumnRow[]): IntrospectedTable[] {
  const tables = new Map<string, IntrospectedTable>()

  for (const row of rows) {
    let table = tables.get(row.TABLE_NAME)
    if (!table) {
      table = { name: row.TABLE_NAME, columns: [] }
      tables.set(row.TABLE_NAME, table)
    }

    const type = oracleTypeToColumnType(row.DATA_TYPE, row.DATA_LENGTH)
    const column: IntrospectedTableColumn = {
      name: row.COLUMN_NAME,
      type,
      nullable: row.NULLABLE === 'Y',
    }
    if (hasLength(type) && row.DATA_LENGTH !== undefined) {
      column.length = row.DATA_LENGTH
    }
    table.columns.push(column)
  }

  return [...tables.values()]
}

// ── Package reconstruction ────────────────────────────────────────────────────

function paramNode(row: IntrospectedArgumentRow): ParamNode {
  return {
    kind: 'param',
    name: row.ARGUMENT_NAME ?? '',
    type: normalizePlsqlType(row.DATA_TYPE),
    direction: normalizeDirection(row.IN_OUT),
    options: {},
  }
}

/** Reconstruct a package node from `ALL_ARGUMENTS` rows for a single package. */
export function packageFromArguments(
  packageName: string,
  rows: IntrospectedArgumentRow[],
): PackageNode {
  const bySubprogram = new Map<string, IntrospectedArgumentRow[]>()
  for (const row of rows) {
    if (row.PACKAGE_NAME.toUpperCase() !== packageName.toUpperCase()) continue
    const list = bySubprogram.get(row.OBJECT_NAME) ?? []
    list.push(row)
    bySubprogram.set(row.OBJECT_NAME, list)
  }

  const procedures: ProcedureNode[] = []
  const functions: FunctionNode[] = []

  for (const [name, args] of bySubprogram) {
    const sorted = args.toSorted((a, b) => a.POSITION - b.POSITION)
    // POSITION 0 with no argument name is the function return value.
    const returnRow = sorted.find((a) => a.POSITION === 0 && a.ARGUMENT_NAME === null)
    const params = sorted.filter((a) => a.ARGUMENT_NAME !== null).map(paramNode)

    if (returnRow) {
      functions.push({
        kind: 'function',
        name,
        params,
        returnType: normalizePlsqlType(returnRow.DATA_TYPE),
        returnTypeOptions: {},
      })
    } else {
      procedures.push({ kind: 'procedure', name, params })
    }
  }

  return { kind: 'package', name: packageName, procedures, functions }
}

// ── Code generation ───────────────────────────────────────────────────────────

function toPascalCase(name: string): string {
  return name
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

function toCamelCase(name: string): string {
  const pascal = toPascalCase(name)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

function columnTypeToTs(type: ColumnType): string {
  switch (type) {
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'date':
    case 'timestamp':
      return 'Date'
    case 'string':
    case 'guid':
    case 'clob':
      return 'string'
  }
}

/** Generate a TypeScript row interface for an introspected table. */
export function generateRowInterface(
  table: IntrospectedTable,
  options: { interfaceName?: string } = {},
): string {
  const name = options.interfaceName ?? toPascalCase(table.name)
  const fields = table.columns.map((c) => {
    const tsType = columnTypeToTs(c.type)
    const nullable = c.nullable ? ' | null' : ''
    return `  ${toCamelCase(c.name)}: ${tsType}${nullable}`
  })
  return [`export interface ${name} {`, ...fields, '}', ''].join('\n')
}

/** Render the `t.<method>('NAME'[, length])` builder call for a column. */
function columnBuilderCall(column: IntrospectedTableColumn): string {
  switch (column.type) {
    case 'string':
      return column.length !== undefined
        ? `t.string('${column.name}', ${column.length})`
        : `t.string('${column.name}')`
    case 'number':
      return `t.number('${column.name}')`
    case 'guid':
      return `t.guid('${column.name}')`
    case 'boolean':
      return `t.boolean('${column.name}')`
    case 'timestamp':
      return `t.timestamp('${column.name}')`
    case 'clob':
      return `t.clob('${column.name}')`
    case 'date':
      return `t.column('${column.name}', 'date')`
  }
}

/** Generate an `odbTable(...)` definition scaffold for an introspected table. */
export function generateTableSource(
  table: IntrospectedTable,
  options: { constName?: string } = {},
): string {
  const constName = options.constName ?? toCamelCase(table.name)
  const fields = table.columns.map((c) => {
    const call = columnBuilderCall(c)
    const notNull = c.nullable ? '' : '.notNull()'
    return `  ${toCamelCase(c.name)}: ${call}${notNull},`
  })
  return [
    `export const ${constName} = odbTable('${table.name}', (t) => ({`,
    ...fields,
    '}))',
    '',
  ].join('\n')
}
