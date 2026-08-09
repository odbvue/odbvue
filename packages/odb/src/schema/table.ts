import {
  Column,
  type ColumnNode,
  type ColumnOptions,
  type ColumnType,
  type ColumnValueForType,
} from './column.js'
import { emitOracleType } from '../model.js'
import {
  odbExpr,
  renderExpression,
  type BinaryExpressionNode,
  type ComparisonOperator,
  type ExpressionNode,
  type InExpressionNode,
  type LogicalExpressionNode,
  type NotNode,
  type NullOperator,
  type NullTestNode,
} from '../query/ast.js'

export type IndexNode = {
  kind: 'index'
  name: string
  columns: string[]
  unique?: boolean
}

type TableIndexDefinition = {
  kind: 'index'
  name?: string
  columns: TableIndexColumn[]
  unique?: boolean
}

export type CheckNode = {
  kind: 'check'
  name: string
  condition: string
}

type TableCheckDefinition = Omit<CheckNode, 'name'> & {
  name?: string
  columns?: TableIndexColumn[]
}

export type TableNode = {
  kind: 'table'
  name: string
  comment?: string
  columns: ColumnNode[]
  indexes: IndexNode[]
  checks: CheckNode[]
}

export type TableSqlOptions = {
  schema?: string
}

export type TableColumnMap = Record<string, Column<any, string, any, any, any, any, any>>
export type TableIndexColumn = string | Column<any, string, any, any, any, any, any>
type TableColumnSelector<TColumns extends TableColumnMap> = (
  columns: TColumns,
) => TableIndexColumn[]

type ColumnValue<TColumn> =
  TColumn extends Column<infer TValue, any, any, any, any, any, any> ? TValue : never

export interface CheckExpressionBuilder {
  <TColumn extends Column<any, string, any, any, any, any, any>>(
    left: TColumn,
    op: ComparisonOperator,
    right: ColumnValue<TColumn>,
  ): BinaryExpressionNode
  <TColumn extends Column<any, string, any, any, any, any, any>>(
    left: TColumn,
    op: NullOperator,
  ): NullTestNode
  in<TColumn extends Column<any, string, any, any, any, any, any>>(
    column: TColumn,
    values: readonly ColumnValue<TColumn>[],
  ): InExpressionNode
  and(expressions: ExpressionNode[]): LogicalExpressionNode
  or(expressions: ExpressionNode[]): LogicalExpressionNode
  not(expression: ExpressionNode): NotNode
}

const checkExpr = odbExpr as CheckExpressionBuilder

type ResolveColumnName<TColumn, TKey extends string> =
  TColumn extends Column<
    infer TValue,
    infer TName,
    infer TNullable,
    infer TDefault,
    infer TGenerated,
    infer TPrimaryKey,
    infer TType
  >
    ? Column<
        TValue,
        TName extends '' ? TKey : TName,
        TNullable,
        TDefault,
        TGenerated,
        TPrimaryKey,
        TType
      >
    : never

type ResolveColumnMap<TColumns extends TableColumnMap> = {
  [TKey in keyof TColumns]: ResolveColumnName<TColumns[TKey], TKey & string>
}

export type TableShape<TColumns extends TableColumnMap = Record<string, never>> = Table<
  ResolveColumnMap<TColumns>
> &
  ResolveColumnMap<TColumns>

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

export type TableColumn<TTable extends Table<any>> = Extract<
  TTable[ColumnKeyOf<TTable>],
  Column<any, string, any, any, any, any>
>

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

export type ColumnIsNullable<TColumn extends Column<any, string, any, any, any, any>> =
  TColumn extends Column<any, any, infer TNullable, any, any, any>
    ? TNullable extends true
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
        : ColumnIsNullable<TTable[TKey]> extends true
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
        : ColumnIsNullable<TTable[TKey]> extends true
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
  private columns: Column<any, string, any, any, any, any, any>[] = []
  private columnNamesByKey = new Map<string, string>()
  private indexes: TableIndexDefinition[] = []
  private checks: TableCheckDefinition[] = []
  private tableComment?: string

  constructor(readonly name: string) {}

  addColumn(column: Column<any, string, any, any, any, any, any>): this {
    if (!this.columns.some((existing) => existing.name === column.name)) {
      this.columns.push(column)
    }
    return this
  }

  /** @internal Resolve a TypeScript table property to its Oracle column name. */
  columnNameForKey(key: string): string {
    return this.columnNamesByKey.get(key) ?? key
  }

  /** @internal Register the property name used for a returned table column. */
  registerColumnKey(key: string, column: Column<any, string, any, any, any, any, any>): this {
    column.assignName(toSnakeCase(key))
    this.columnNamesByKey.set(key, column.name)
    this.addColumn(column)
    return this
  }

  column<TName extends string, TType extends ColumnType = ColumnType>(
    name: TName,
    type: TType,
    options: ColumnOptions = {},
  ): Column<ColumnValueForType<TType>, TName, true, false, false, false, TType> {
    const column = new Column<ColumnValueForType<TType>, TName, true, false, false, false, TType>(
      name,
      type,
      options,
    )
    this.addColumn(column)
    return column
  }

  string(): Column<string, '', true, false, false, false, 'string'>
  string(length: number): Column<string, '', true, false, false, false, 'string'>
  string<TName extends string>(
    name: TName,
    length?: number,
  ): Column<string, TName, true, false, false, false, 'string'>
  string(
    nameOrLength?: string | number,
    length = 255,
  ): Column<string, string, true, false, false, false, 'string'> {
    const name = typeof nameOrLength === 'string' ? nameOrLength : ''
    const resolvedLength = typeof nameOrLength === 'number' ? nameOrLength : length
    return this.createColumn(name, 'string', { length: resolvedLength })
  }

  number(): Column<number, '', true, false, false, false, 'number'>
  number<TName extends string>(
    name: TName,
  ): Column<number, TName, true, false, false, false, 'number'>
  number(name = ''): Column<number, string, true, false, false, false, 'number'> {
    return this.createColumn(name, 'number')
  }

  guid(): Column<string, '', true, false, false, false, 'guid'>
  guid<TName extends string>(name: TName): Column<string, TName, true, false, false, false, 'guid'>
  guid(name = ''): Column<string, string, true, false, false, false, 'guid'> {
    return this.createColumn(name, 'guid')
  }

  boolean(): Column<boolean, '', true, false, false, false, 'boolean'>
  boolean<TName extends string>(
    name: TName,
  ): Column<boolean, TName, true, false, false, false, 'boolean'>
  boolean(name = ''): Column<boolean, string, true, false, false, false, 'boolean'> {
    return this.createColumn(name, 'boolean')
  }

  timestamp(): Column<Date, '', true, false, false, false, 'timestamp'>
  timestamp<TName extends string>(
    name: TName,
  ): Column<Date, TName, true, false, false, false, 'timestamp'>
  timestamp(name = ''): Column<Date, string, true, false, false, false, 'timestamp'> {
    return this.createColumn(name, 'timestamp')
  }

  clob(): Column<string, '', true, false, false, false, 'clob'>
  clob<TName extends string>(name: TName): Column<string, TName, true, false, false, false, 'clob'>
  clob(name = ''): Column<string, string, true, false, false, false, 'clob'> {
    return this.createColumn(name, 'clob')
  }

  private createColumn<TName extends string, TType extends ColumnType>(
    name: TName,
    type: TType,
    options: ColumnOptions = {},
  ): Column<ColumnValueForType<TType>, TName, true, false, false, false, TType> {
    const column = new Column<ColumnValueForType<TType>, TName, true, false, false, false, TType>(
      name,
      type,
      options,
    )
    if (name !== '') this.addColumn(column)
    return column
  }

  index(columns: TableIndexColumn[] | TableColumnSelector<TColumns>): this
  index(name: string, columns: TableIndexColumn[]): this
  index(name: string, select: TableColumnSelector<TColumns>): this
  index(
    nameOrColumns: string | TableIndexColumn[] | TableColumnSelector<TColumns>,
    columns?: TableIndexColumn[] | TableColumnSelector<TColumns>,
  ): this {
    this.indexes.push({
      kind: 'index',
      name: typeof nameOrColumns === 'string' ? nameOrColumns : undefined,
      columns: this.resolveSelectedColumns(
        typeof nameOrColumns === 'string' ? (columns ?? []) : nameOrColumns,
      ),
    })

    return this
  }

  unique(columns: TableIndexColumn[] | TableColumnSelector<TColumns>): this
  unique(name: string, columns: TableIndexColumn[]): this
  unique(name: string, select: TableColumnSelector<TColumns>): this
  unique(
    nameOrColumns: string | TableIndexColumn[] | TableColumnSelector<TColumns>,
    columns?: TableIndexColumn[] | TableColumnSelector<TColumns>,
  ): this {
    this.indexes.push({
      kind: 'index',
      name: typeof nameOrColumns === 'string' ? nameOrColumns : undefined,
      columns: this.resolveSelectedColumns(
        typeof nameOrColumns === 'string' ? (columns ?? []) : nameOrColumns,
      ),
      unique: true,
    })

    return this
  }

  check(columns: TableIndexColumn[], condition: string): this
  check(name: string, condition: string): this
  check(build: (columns: TColumns, expression: CheckExpressionBuilder) => ExpressionNode): this
  check(
    name: string,
    build: (columns: TColumns, expression: CheckExpressionBuilder) => ExpressionNode,
  ): this
  check(
    nameOrColumns:
      | string
      | TableIndexColumn[]
      | ((columns: TColumns, expression: CheckExpressionBuilder) => ExpressionNode),
    condition?:
      | string
      | ((columns: TColumns, expression: CheckExpressionBuilder) => ExpressionNode),
  ): this {
    const build =
      typeof nameOrColumns === 'function'
        ? nameOrColumns
        : typeof condition === 'function'
          ? condition
          : undefined
    const expression = build?.(this.columnShape(), checkExpr)
    this.checks.push({
      kind: 'check',
      name: typeof nameOrColumns === 'string' ? nameOrColumns : undefined,
      columns:
        expression !== undefined
          ? collectExpressionColumns(expression)
          : Array.isArray(nameOrColumns)
            ? nameOrColumns
            : undefined,
      condition: expression === undefined ? (condition as string) : renderExpression(expression),
    })
    return this
  }

  private resolveSelectedColumns(
    columns: TableIndexColumn[] | TableColumnSelector<TColumns>,
  ): TableIndexColumn[] {
    return typeof columns === 'function' ? columns(this.columnShape()) : columns
  }

  private columnShape(): TColumns {
    return this as unknown as TColumns
  }

  comment(value: string): this {
    this.tableComment = value
    return this
  }

  toNode(): TableNode {
    return {
      kind: 'table',
      name: this.name,
      comment: this.tableComment,
      columns: this.columns.map((c) => c.toNode()),
      indexes: this.indexes.map((index) => {
        const columns = index.columns.map(resolveIndexColumnName)
        return {
          ...index,
          name:
            index.name ??
            generatedObjectName(index.unique ? 'unique' : 'index', this.name, columns),
          columns,
        }
      }),
      checks: this.checks.map((check) => {
        const columns = check.columns?.map(resolveIndexColumnName) ?? []
        return {
          kind: check.kind,
          name: check.name ?? generatedObjectName('check', this.name, columns),
          condition: check.condition,
        }
      }),
    }
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
    columnSql.push(`CONSTRAINT primary_key_${table.name} PRIMARY KEY (${primaryKeys.join(', ')})`)
  }

  for (const check of table.checks) {
    columnSql.push(`CONSTRAINT ${check.name} CHECK (${check.condition})`)
  }

  return [
    `CREATE TABLE ${tableName} (`,
    `  ${columnSql.join(',\n  ')}`,
    `);`,
    ...table.indexes.map((index) => emitOracleIndex(table.name, index, options)),
    ...(table.comment
      ? [`COMMENT ON TABLE ${tableName} IS ${quoteOracleString(table.comment)};`]
      : []),
    ...table.columns
      .filter((column) => column.options.comment !== undefined)
      .map(
        (column) =>
          `COMMENT ON COLUMN ${tableName}.${column.name} IS ${quoteOracleString(column.options.comment ?? '')};`,
      ),
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

  if (column.options.identity) {
    parts.push('GENERATED BY DEFAULT AS IDENTITY')
  } else if (column.options.default === 'sys_guid') {
    parts.push('DEFAULT LOWER(SYS_GUID())')
  } else if (column.options.default === 'sys_timestamp') {
    parts.push('DEFAULT SYSTIMESTAMP')
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

function collectExpressionColumns(expression: ExpressionNode): TableIndexColumn[] {
  const columns = new Map<string, string>()

  const visit = (node: ExpressionNode): void => {
    switch (node.kind) {
      case 'column':
        columns.set(node.name, node.name)
        break
      case 'binary':
        visit(node.left)
        visit(node.right)
        break
      case 'in':
        visit(node.operand)
        node.values.forEach(visit)
        break
      case 'nullTest':
      case 'not':
        visit(node.kind === 'nullTest' ? node.operand : node.operand)
        break
      case 'logical':
        node.expressions.forEach(visit)
        break
      case 'function':
        node.args.forEach(visit)
        break
      case 'subquery':
      case 'raw':
      case 'value':
        break
    }
  }

  visit(expression)
  return [...columns.values()]
}

function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
}

function generatedObjectName(
  prefix: 'index' | 'unique' | 'check',
  table: string,
  columns: string[],
): string {
  return [prefix, table, ...columns].map(toSnakeCase).join('_')
}

function qualifyName(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

function quoteOracleString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
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
        t.registerColumnKey(key, value)
        if (!(key in tableWithColumns)) {
          ;(tableWithColumns as Record<string, unknown>)[key] = value
        }
      }
    }
  }

  return t as TableShape<TColumns>
}
