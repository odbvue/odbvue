import { Column, type ColumnNode } from '../schema/column.js'
import {
  type ColumnKeyOf,
  type Insertable,
  type Selectable,
  type SelectableColumnValue,
  type Table,
  type TableColumn,
  type Updateable,
} from '../schema/table.js'
import {
  BindContext,
  combinePredicates,
  compileNode,
  inlineValue,
  odbExpr,
  predicate,
  renderNode,
  type ComparisonOperator,
  type CompiledQuery,
  type ExpressionBuilder,
  type ExpressionNode,
  type NullOperator,
  type Operator,
} from './ast.js'

type OrderByClause = {
  column: string
  direction: 'asc' | 'desc'
}

type ColumnLike = Column<any, string, any, any, any, any>

type SelectedRow<TTable extends Table<any>, TColumns extends readonly ColumnLike[]> = {
  [TKey in ColumnKeyOf<TTable> as TTable[TKey] extends TColumns[number]
    ? TKey
    : never]: TTable[TKey] extends ColumnLike ? SelectableColumnValue<TTable[TKey]> : never
}

type Simplify<T> = { [TKey in keyof T]: T[TKey] }

type AccumulatedRow<TResult, TSelection, THasSelection extends boolean> = THasSelection extends true
  ? Simplify<TResult & TSelection>
  : TSelection

/** Any object that carries a SQL identifier, such as a Table or a Column. */
export type NamedRef = { readonly name: string }

/** A column/select expression: a raw string or anything that renders to SQL. */
export type SqlExpr = string | { toSQL(): string }

/** Resolve the identifier name from a raw string or a named reference. */
function refName(ref: string | NamedRef): string {
  return typeof ref === 'string' ? ref : ref.name
}

/** Render a column/select expression to its SQL text. */
function exprSql(expr: SqlExpr): string {
  return typeof expr === 'string' ? expr : expr.toSQL()
}

/** Build a predicate node from a builder callback or a column/op/value triple. */
function toPredicate(
  column: string | Column<any, string> | ((eb: ExpressionBuilder) => ExpressionNode),
  op?: Operator,
  value?: unknown,
): ExpressionNode {
  if (typeof column === 'function') return column(odbExpr)
  return predicate(column, op as Operator, value)
}

export class SelectQueryBuilder<
  TTable extends Table<any> = Table<any>,
  TResult = Selectable<TTable>,
  THasSelection extends boolean = false,
> {
  private readonly _resultType?: TResult
  private readonly _hasSelectionType?: THasSelection
  private _columns: string[] = []
  private _selectedColumns: ColumnNode[] | undefined = []
  private _where: ExpressionNode[] = []
  private _orderBy: OrderByClause[] = []
  private _limit?: number
  private _into?: string
  private _schema?: string

  constructor(private readonly _table: string | NamedRef) {}

  /** Qualify a table reference with the given schema (no-op for raw strings). */
  resolveSchema(schema: string): this {
    this._schema = schema
    return this
  }

  private tableName(): string {
    if (typeof this._table === 'string') return this._table
    return this._schema ? `${this._schema}.${this._table.name}` : this._table.name
  }

  select<TColumn extends TableColumn<TTable>>(
    column: TColumn,
  ): SelectQueryBuilder<
    TTable,
    AccumulatedRow<TResult, SelectedRow<TTable, [TColumn]>, THasSelection>,
    true
  >
  select<TColumns extends readonly TableColumn<TTable>[]>(
    columns: [...TColumns],
  ): SelectQueryBuilder<
    TTable,
    AccumulatedRow<TResult, SelectedRow<TTable, TColumns>, THasSelection>,
    true
  >
  select<TExpression extends SqlExpr>(
    columns: TExpression extends ColumnLike ? never : TExpression,
  ): SelectQueryBuilder<TTable, unknown, true>
  select<TExpressions extends readonly SqlExpr[]>(
    columns: TExpressions[number] extends ColumnLike ? never : [...TExpressions],
  ): SelectQueryBuilder<TTable, unknown, true>
  select(columns: SqlExpr | SqlExpr[]): SelectQueryBuilder<TTable, unknown, true> {
    const cols = Array.isArray(columns) ? columns : [columns]
    this._columns.push(...cols.map(exprSql))
    if (this._selectedColumns) {
      if (cols.every((column) => column instanceof Column)) {
        this._selectedColumns.push(...cols.map((column) => (column as ColumnLike).toNode()))
      } else {
        this._selectedColumns = undefined
      }
    }
    return this as SelectQueryBuilder<TTable, unknown, true>
  }

  /** Selected typed columns, when the row shape can be inferred without parsing SQL. */
  selectedColumns(): ColumnNode[] | undefined {
    return this._selectedColumns?.map((column) => ({
      ...column,
      options: { ...column.options },
    }))
  }

  where(build: (eb: ExpressionBuilder) => ExpressionNode): this
  where<TColumn extends TableColumn<TTable>>(
    column: TColumn,
    op: ComparisonOperator,
    value: TColumn extends Column<infer TValue, string> ? TValue : never,
  ): this
  where<TColumn extends TableColumn<TTable>>(
    column: TColumn,
    op: NullOperator,
    value?: undefined,
  ): this
  where(column: string, op: ComparisonOperator, value: unknown): this
  where(column: string, op: NullOperator): this
  where(
    column: string | Column<any, string> | ((eb: ExpressionBuilder) => ExpressionNode),
    op?: Operator,
    value?: unknown,
  ): this {
    this._where.push(toPredicate(column, op, value))
    return this
  }

  orderBy(column: TableColumn<TTable>, direction?: 'asc' | 'desc'): this
  orderBy(column: string, direction?: 'asc' | 'desc'): this
  orderBy(column: string | ColumnLike, direction: 'asc' | 'desc' = 'asc'): this {
    this._orderBy.push({ column: typeof column === 'string' ? column : column.name, direction })
    return this
  }

  limit(n: number): this {
    this._limit = n
    return this
  }

  into(target: string | NamedRef): this {
    this._into = refName(target)
    return this
  }

  compile(): CompiledQuery {
    const bindings: Record<string, unknown> = {}
    const cols = this._columns.length > 0 ? this._columns.join(', ') : '*'
    let sql = `SELECT ${cols}`

    if (this._into) {
      sql += ` INTO ${this._into}`
    }

    sql += ` FROM ${this.tableName()}`

    const whereNode = combinePredicates(this._where)
    if (whereNode) {
      const ctx = new BindContext('w')
      sql += ` WHERE ${compileNode(whereNode, ctx)}`
      Object.assign(bindings, ctx.bindings)
    }

    if (this._orderBy.length > 0) {
      const parts = this._orderBy.map((o) => `${o.column} ${o.direction.toUpperCase()}`)
      sql += ` ORDER BY ${parts.join(', ')}`
    }

    if (this._limit !== undefined) {
      sql += ` FETCH FIRST ${this._limit} ROWS ONLY`
    }

    return { sql, bindings }
  }

  toSQL(): string {
    const cols = this._columns.length > 0 ? this._columns.join(', ') : '*'
    let sql = `SELECT ${cols}`
    if (this._into) sql += ` INTO ${this._into}`
    sql += ` FROM ${this.tableName()}`
    const whereNode = combinePredicates(this._where)
    if (whereNode) sql += ` WHERE ${renderNode(whereNode)}`
    if (this._orderBy.length > 0) {
      const parts = this._orderBy.map((o) => `${o.column} ${o.direction.toUpperCase()}`)
      sql += ` ORDER BY ${parts.join(', ')}`
    }
    if (this._limit !== undefined) sql += ` FETCH FIRST ${this._limit} ROWS ONLY`
    return sql
  }
}

export type SelectQuery<TResult> = SelectQueryBuilder<any, TResult, true>

export class InsertQueryBuilder<TTable extends Table<any> = Table<any>> {
  private _values: Record<string, unknown> = {}
  private _schema?: string

  constructor(private readonly _table: string | NamedRef) {}

  resolveSchema(schema: string): this {
    this._schema = schema
    return this
  }

  private tableName(): string {
    if (typeof this._table === 'string') return this._table
    return this._schema ? `${this._schema}.${this._table.name}` : this._table.name
  }

  private columnName(key: string): string {
    return this._table instanceof Object && 'columnNameForKey' in this._table
      ? (this._table as Table<any>).columnNameForKey(key)
      : key
  }

  values(row: Insertable<TTable>): this {
    this._values = { ...row }
    return this
  }

  compile(): CompiledQuery {
    const keys = Object.keys(this._values)
    const bindings: Record<string, unknown> = {}
    for (const k of keys) bindings[k] = this._values[k]

    const cols = keys.map((key) => this.columnName(key)).join(', ')
    const vals = keys.map((k) => `:${k}`).join(', ')

    return {
      sql: `INSERT INTO ${this.tableName()} (${cols}) VALUES (${vals})`,
      bindings,
    }
  }

  toSQL(): string {
    const keys = Object.keys(this._values)
    const cols = keys.map((key) => this.columnName(key)).join(', ')
    const vals = keys.map((k) => inlineValue(this._values[k])).join(', ')
    return `INSERT INTO ${this.tableName()} (${cols}) VALUES (${vals})`
  }
}

export class UpdateQueryBuilder<TTable extends Table<any> = Table<any>> {
  private _set: Record<string, unknown> = {}
  private _where: ExpressionNode[] = []
  private _schema?: string

  constructor(private readonly _table: string | NamedRef) {}

  resolveSchema(schema: string): this {
    this._schema = schema
    return this
  }

  private tableName(): string {
    if (typeof this._table === 'string') return this._table
    return this._schema ? `${this._schema}.${this._table.name}` : this._table.name
  }

  private columnName(key: string): string {
    return this._table instanceof Object && 'columnNameForKey' in this._table
      ? (this._table as Table<any>).columnNameForKey(key)
      : key
  }

  set(values: Updateable<TTable>): this {
    this._set = { ...values }
    return this
  }

  where(build: (eb: ExpressionBuilder) => ExpressionNode): this
  where<TColumn extends TableColumn<TTable>>(
    column: TColumn,
    op: ComparisonOperator,
    value: TColumn extends Column<infer TValue, string> ? TValue : never,
  ): this
  where<TColumn extends TableColumn<TTable>>(
    column: TColumn,
    op: NullOperator,
    value?: undefined,
  ): this
  where(column: string, op: ComparisonOperator, value: unknown): this
  where(column: string, op: NullOperator): this
  where(
    column: string | Column<any, string> | ((eb: ExpressionBuilder) => ExpressionNode),
    op?: Operator,
    value?: unknown,
  ): this {
    this._where.push(toPredicate(column, op, value))
    return this
  }

  compile(): CompiledQuery {
    const bindings: Record<string, unknown> = {}

    const setClauses = Object.keys(this._set).map((k) => {
      const key = `s_${k}`
      bindings[key] = this._set[k]
      return `${this.columnName(k)} = :${key}`
    })

    let sql = `UPDATE ${this.tableName()} SET ${setClauses.join(', ')}`

    const whereNode = combinePredicates(this._where)
    if (whereNode) {
      const ctx = new BindContext('w')
      sql += ` WHERE ${compileNode(whereNode, ctx)}`
      Object.assign(bindings, ctx.bindings)
    }

    return { sql, bindings }
  }

  toSQL(): string {
    const setClauses = Object.keys(this._set).map(
      (k) => `${this.columnName(k)} = ${inlineValue(this._set[k])}`,
    )
    let sql = `UPDATE ${this.tableName()} SET ${setClauses.join(', ')}`
    const whereNode = combinePredicates(this._where)
    if (whereNode) sql += ` WHERE ${renderNode(whereNode)}`
    return sql
  }
}

export class DeleteQueryBuilder<TTable extends Table<any> = Table<any>> {
  private _where: ExpressionNode[] = []
  private _schema?: string

  constructor(private readonly _table: string | NamedRef) {}

  resolveSchema(schema: string): this {
    this._schema = schema
    return this
  }

  private tableName(): string {
    if (typeof this._table === 'string') return this._table
    return this._schema ? `${this._schema}.${this._table.name}` : this._table.name
  }

  where(build: (eb: ExpressionBuilder) => ExpressionNode): this
  where<TColumn extends TableColumn<TTable>>(
    column: TColumn,
    op: ComparisonOperator,
    value: TColumn extends Column<infer TValue, string> ? TValue : never,
  ): this
  where<TColumn extends TableColumn<TTable>>(
    column: TColumn,
    op: NullOperator,
    value?: undefined,
  ): this
  where(column: string, op: ComparisonOperator, value: unknown): this
  where(column: string, op: NullOperator): this
  where(
    column: string | Column<any, string> | ((eb: ExpressionBuilder) => ExpressionNode),
    op?: Operator,
    value?: unknown,
  ): this {
    this._where.push(toPredicate(column, op, value))
    return this
  }

  compile(): CompiledQuery {
    const bindings: Record<string, unknown> = {}
    let sql = `DELETE FROM ${this.tableName()}`

    const whereNode = combinePredicates(this._where)
    if (whereNode) {
      const ctx = new BindContext('w')
      sql += ` WHERE ${compileNode(whereNode, ctx)}`
      Object.assign(bindings, ctx.bindings)
    }

    return { sql, bindings }
  }

  toSQL(): string {
    let sql = `DELETE FROM ${this.tableName()}`
    const whereNode = combinePredicates(this._where)
    if (whereNode) sql += ` WHERE ${renderNode(whereNode)}`
    return sql
  }
}

export class OdbQuery {
  selectFrom<TTable extends Table<any>>(table: TTable): SelectQueryBuilder<TTable>
  selectFrom(table: string | NamedRef): SelectQueryBuilder
  selectFrom(table: string | NamedRef | Table<any>): SelectQueryBuilder<any> {
    return new SelectQueryBuilder(table as string | NamedRef)
  }

  insertInto<TTable extends Table<any>>(table: TTable): InsertQueryBuilder<TTable>
  insertInto(table: string | NamedRef): InsertQueryBuilder
  insertInto(table: string | NamedRef | Table<any>): InsertQueryBuilder<any> {
    return new InsertQueryBuilder(table as string | NamedRef)
  }

  updateTable<TTable extends Table<any>>(table: TTable): UpdateQueryBuilder<TTable>
  updateTable(table: string | NamedRef): UpdateQueryBuilder
  updateTable(table: string | NamedRef | Table<any>): UpdateQueryBuilder<any> {
    return new UpdateQueryBuilder(table as string | NamedRef)
  }

  deleteFrom<TTable extends Table<any>>(table: TTable): DeleteQueryBuilder<TTable>
  deleteFrom(table: string | NamedRef): DeleteQueryBuilder
  deleteFrom(table: string | NamedRef | Table<any>): DeleteQueryBuilder<any> {
    return new DeleteQueryBuilder(table as string | NamedRef)
  }
}

export function odbQuery(): OdbQuery {
  return new OdbQuery()
}
