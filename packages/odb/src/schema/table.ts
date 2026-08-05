import {
  Column,
  type ColumnNode,
  type ColumnOptions,
  type ColumnType,
  type ColumnValueForType,
} from './column.js'
import { emitOracleType } from '../model.js'

export type IndexNode = {
  kind: 'index'
  name: string
  columns: string[]
  unique?: boolean
}

export type TableNode = {
  kind: 'table'
  name: string
  columns: ColumnNode[]
  indexes: IndexNode[]
}

export type TableSqlOptions = {
  schema?: string
}

export type TableColumnMap = Record<string, Column<any, string, any, any, any, any>>
export type TableIndexColumn = string | Column<any, string, any, any, any, any>

export type TableShape<TColumns extends TableColumnMap = Record<string, never>> = Table<TColumns> &
  TColumns

export type ColumnName<TColumn extends Column<any, string, any, any, any, any>> =
  TColumn extends Column<any, infer TName, any, any, any, any> ? TName : never

export type SelectableColumnValue<TColumn extends Column<any, string, any, any, any, any>> =
  TColumn extends Column<infer TValue, any, infer TNullable, any, any, any>
    ? TNullable extends true
      ? TValue | null
      : TValue
    : never

export type ColumnKeyOf<TTable extends Table<any>> = {
  [TKey in keyof TTable]: TTable[TKey] extends Column<any, string, any, any, any, any>
    ? TKey & string
    : never
}[keyof TTable]

export type Selectable<TTable extends Table<any>> = {
  [TKey in ColumnKeyOf<TTable> as TKey]: TTable[TKey] extends Column<
    any,
    string,
    any,
    any,
    any,
    any
  >
    ? SelectableColumnValue<TTable[TKey]>
    : never
}

export type ColumnHasDefault<TColumn extends Column<any, string, any, any, any, any>> =
  TColumn extends Column<any, any, any, infer TDefault, any, any>
    ? TDefault extends true
      ? true
      : false
    : false

export type ColumnIsGenerated<TColumn extends Column<any, string, any, any, any, any>> =
  TColumn extends Column<any, any, any, any, infer TGenerated, any>
    ? TGenerated extends true
      ? true
      : false
    : false

export type InsertableValue<TColumn extends Column<any, string, any, any, any, any>> =
  TColumn extends Column<infer TValue, any, infer TNullable, any, any, any>
    ? TNullable extends true
      ? TValue | null
      : TValue
    : never

export type RequiredInsertableKeys<TTable extends Table<any>> = {
  [TKey in ColumnKeyOf<TTable>]: TTable[TKey] extends Column<any, string, any, any, any, any>
    ? ColumnIsGenerated<TTable[TKey]> extends true
      ? never
      : ColumnHasDefault<TTable[TKey]> extends true
        ? never
        : TKey
    : never
}[ColumnKeyOf<TTable>]

export type OptionalInsertableKeys<TTable extends Table<any>> = {
  [TKey in ColumnKeyOf<TTable>]: TTable[TKey] extends Column<any, string, any, any, any, any>
    ? ColumnIsGenerated<TTable[TKey]> extends true
      ? never
      : ColumnHasDefault<TTable[TKey]> extends true
        ? TKey
        : never
    : never
}[ColumnKeyOf<TTable>]

type Simplify<T> = { [TKey in keyof T]: T[TKey] }

export type Insertable<TTable extends Table<any>> = Simplify<
  {
    [TKey in RequiredInsertableKeys<TTable>]: TTable[TKey] extends Column<
      any,
      string,
      any,
      any,
      any,
      any
    >
      ? InsertableValue<TTable[TKey]>
      : never
  } & Partial<{
    [TKey in OptionalInsertableKeys<TTable>]: TTable[TKey] extends Column<
      any,
      string,
      any,
      any,
      any,
      any
    >
      ? InsertableValue<TTable[TKey]>
      : never
  }>
>

export type Updateable<TTable extends Table<any>> = Partial<{
  [TKey in ColumnKeyOf<TTable> as TTable[TKey] extends Column<any, string, any, any, any, any>
    ? ColumnIsGenerated<TTable[TKey]> extends true
      ? never
      : TKey
    : never]: TTable[TKey] extends Column<any, string, any, any, any, any>
    ? InsertableValue<TTable[TKey]>
    : never
}>

export class Table<TColumns extends TableColumnMap = Record<string, never>> {
  private readonly _shape?: TColumns
  private columns: Column<any, string, any, any, any, any>[] = []
  private indexes: IndexNode[] = []

  constructor(readonly name: string) {}

  addColumn(column: Column<any, string, any, any, any, any>): this {
    if (!this.columns.some((existing) => existing.name === column.name)) {
      this.columns.push(column)
    }
    return this
  }

  column<TName extends string, TType extends ColumnType = ColumnType>(
    name: TName,
    type: TType,
    options: ColumnOptions = {},
  ): Column<ColumnValueForType<TType>, TName> {
    const column = new Column<ColumnValueForType<TType>, TName>(name, type, options)
    this.addColumn(column)
    return column
  }

  string<TName extends string>(name: TName, length = 255): Column<string, TName> {
    return this.column(name, 'string', { length })
  }

  number<TName extends string>(name: TName): Column<number, TName> {
    return this.column(name, 'number')
  }

  guid<TName extends string>(name: TName): Column<string, TName> {
    return this.column(name, 'guid')
  }

  boolean<TName extends string>(name: TName): Column<boolean, TName> {
    return this.column(name, 'boolean')
  }

  timestamp<TName extends string>(name: TName): Column<Date, TName> {
    return this.column(name, 'timestamp')
  }

  clob<TName extends string>(name: TName): Column<string, TName> {
    return this.column(name, 'clob')
  }

  index(name: string, columns: TableIndexColumn[]): this {
    this.indexes.push({
      kind: 'index',
      name,
      columns: columns.map(resolveIndexColumnName),
    })

    return this
  }

  unique(name: string, columns: TableIndexColumn[]): this {
    this.indexes.push({
      kind: 'index',
      name,
      columns: columns.map(resolveIndexColumnName),
      unique: true,
    })

    return this
  }

  toNode(): TableNode {
    return {
      kind: 'table',
      name: this.name,
      columns: this.columns.map((c) => c.toNode()),
      indexes: [...this.indexes],
    }
  }

  toObject() {
    return this.toNode()
  }

  toSQLUp(options: TableSqlOptions = {}): string {
    return emitOracleCreateTable(this.toNode(), options)
  }

  toSQLDown(options: TableSqlOptions = {}): string {
    return emitOracleDropTable(this.name, options.schema)
  }
}

function emitOracleCreateTable(table: TableNode, options: TableSqlOptions = {}): string {
  const columnSql = table.columns.map(emitOracleColumn)
  const tableName = qualifyName(table.name, options.schema)

  const primaryKeys = table.columns.filter((c) => c.options.primaryKey).map((c) => c.name)

  if (primaryKeys.length > 0) {
    columnSql.push(`CONSTRAINT pk_${table.name} PRIMARY KEY (${primaryKeys.join(', ')})`)
  }

  return [
    `CREATE TABLE ${tableName} (`,
    `  ${columnSql.join(',\n  ')}`,
    `);`,
    ...table.indexes.map((index) => emitOracleIndex(table.name, index, options)),
  ].join('\n')
}

function emitOracleDropTable(table: TableNode | string, schema?: string): string {
  const tableName = typeof table === 'string' ? table : table.name
  const name = qualifyName(tableName, schema)
  return [
    `BEGIN`,
    `  EXECUTE IMMEDIATE 'DROP TABLE ${name} CASCADE CONSTRAINTS';`,
    `EXCEPTION WHEN OTHERS THEN`,
    `  IF SQLCODE != -942 THEN RAISE; END IF;`,
    `END;`,
    `/`,
  ].join('\n')
}

function emitOracleColumn(column: ColumnNode): string {
  const parts = [column.name, emitOracleType(column.type, column.options)]

  if (column.options.default === 'sys_guid') {
    parts.push('DEFAULT SYS_GUID()')
  } else if (column.options.default === 'current_timestamp') {
    parts.push('DEFAULT CURRENT_TIMESTAMP')
  } else if (column.options.default) {
    parts.push(`DEFAULT ${column.options.default}`)
  }

  if (column.options.nullable === false) {
    parts.push('NOT NULL')
  }

  if (column.options.unique) {
    parts.push('UNIQUE')
  }

  return parts.join(' ')
}

function emitOracleIndex(
  tableName: string,
  index: IndexNode,
  options: TableSqlOptions = {},
): string {
  const unique = index.unique ? 'UNIQUE ' : ''

  return `CREATE ${unique}INDEX ${qualifyName(index.name, options.schema)} ON ${qualifyName(tableName, options.schema)} (${index.columns.join(', ')});`
}

function resolveIndexColumnName(column: TableIndexColumn): string {
  return typeof column === 'string' ? column : column.name
}

function qualifyName(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

export function odbTable<TColumns extends TableColumnMap>(
  name: string,
  build?: (table: Table<any>) => void | TColumns,
): TableShape<TColumns> {
  const t = new Table<any>(name)
  const result = build?.(t)

  if (result && typeof result === 'object') {
    const tableWithColumns = t as TableShape<TColumns>
    for (const [key, value] of Object.entries(result)) {
      if (value instanceof Column) {
        t.addColumn(value)
        if (!(key in tableWithColumns)) {
          ;(tableWithColumns as Record<string, unknown>)[key] = value
        }
      }
    }
  }

  return t as TableShape<TColumns>
}
