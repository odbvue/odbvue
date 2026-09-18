import { Column, type ColumnNode } from '../schema/column.js'
import {
  type ColumnKeyOf,
  type Insertable,
  type Selectable,
  type SelectableColumnValue,
  Table,
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

type SqlPredicate = { toSQL(): string; toQuerySQL?(): string }

type OrderByClause = {
  column: string
  direction: 'asc' | 'desc'
}

type JoinClause = {
  table: string | NamedRef
  on: ExpressionNode
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

function isSqlExpression(value: unknown): value is { toSQL(): string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toSQL' in value &&
    typeof value.toSQL === 'function'
  )
}

/** Build a predicate node from a builder callback or a column/op/value triple. */
function toPredicate(
  column: string | Column<any, string> | SqlPredicate | ((eb: ExpressionBuilder) => ExpressionNode),
  op?: Operator,
  value?: unknown,
): ExpressionNode {
  if (typeof column === 'function') return column(odbExpr)
  if (op === undefined && isSqlExpression(column)) {
    const condition = column as SqlPredicate
    return { kind: 'raw', sql: condition.toQuerySQL?.() ?? condition.toSQL() }
  }
  return predicate(column as string | Column<any, string>, op as Operator, value)
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
  private _joins: JoinClause[] = []
  private _orderBy: OrderByClause[] = []
  private _limit?: number
  private _forUpdate = false
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
    if (this._table instanceof Table) return this._table.queryName(this._schema)
    return this._schema ? `${this._schema}.${this._table.name}` : this._table.name
  }

  join<TJoin extends Table<any>>(
    table: TJoin,
    on: (eb: ExpressionBuilder) => ExpressionNode,
  ): SelectQueryBuilder<TTable | TJoin, TResult, THasSelection>
  join<TJoin extends Table<any>>(
    table: TJoin,
    on: SqlPredicate,
  ): SelectQueryBuilder<TTable | TJoin, TResult, THasSelection>
  join(table: string | NamedRef, on: (eb: ExpressionBuilder) => ExpressionNode): this
  join(
    table: string | NamedRef | Table<any>,
    on: ((eb: ExpressionBuilder) => ExpressionNode) | SqlPredicate,
  ): SelectQueryBuilder<any, TResult, THasSelection> {
    this._joins.push({
      table: table as string | NamedRef,
      on:
        typeof on === 'function'
          ? on(odbExpr)
          : { kind: 'raw', sql: on.toQuerySQL?.() ?? on.toSQL() },
    })
    return this as SelectQueryBuilder<any, TResult, THasSelection>
  }

  private joinedTableName(table: string | NamedRef): string {
    if (typeof table === 'string') return table
    if (table instanceof Table) return table.queryName(this._schema)
    return this._schema ? `${this._schema}.${table.name}` : table.name
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
  where(condition: SqlPredicate): this
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
    column:
      | string
      | Column<any, string>
      | SqlPredicate
      | ((eb: ExpressionBuilder) => ExpressionNode),
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

  /** Lock the selected rows for update. */
  forUpdate(): this {
    this._forUpdate = true
    return this
  }

  /** Assign selected values into one or more PL/SQL variables or parameters. */
  into(...targets: (string | NamedRef)[]): this {
    this._into = targets.map(refName).join(', ')
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

    const ctx = new BindContext('w')
    for (const join of this._joins) {
      sql += ` JOIN ${this.joinedTableName(join.table)} ON ${compileNode(join.on, ctx)}`
    }

    const whereNode = combinePredicates(this._where)
    if (whereNode) {
      sql += ` WHERE ${compileNode(whereNode, ctx)}`
    }
    Object.assign(bindings, ctx.bindings)

    if (this._orderBy.length > 0) {
      const parts = this._orderBy.map((o) => `${o.column} ${o.direction.toUpperCase()}`)
      sql += ` ORDER BY ${parts.join(', ')}`
    }

    if (this._limit !== undefined) {
      sql += ` FETCH FIRST ${this._limit} ROWS ONLY`
    }
    if (this._forUpdate) sql += ' FOR UPDATE'

    return { sql, bindings }
  }

  toSQL(): string {
    const cols = this._columns.length > 0 ? this._columns.join(', ') : '*'
    let sql = `SELECT ${cols}`
    if (this._into) sql += ` INTO ${this._into}`
    sql += ` FROM ${this.tableName()}`
    for (const join of this._joins) {
      sql += ` JOIN ${this.joinedTableName(join.table)} ON ${renderNode(join.on)}`
    }
    const whereNode = combinePredicates(this._where)
    if (whereNode) sql += ` WHERE ${renderNode(whereNode)}`
    if (this._orderBy.length > 0) {
      const parts = this._orderBy.map((o) => `${o.column} ${o.direction.toUpperCase()}`)
      sql += ` ORDER BY ${parts.join(', ')}`
    }
    if (this._limit !== undefined) sql += ` FETCH FIRST ${this._limit} ROWS ONLY`
    if (this._forUpdate) sql += ' FOR UPDATE'
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

    const cols = keys.map((key) => this.columnName(key)).join(', ')
    const vals = keys
      .map((key) => {
        const value = this._values[key]
        if (isSqlExpression(value)) return value.toSQL()
        bindings[key] = value
        return `:${key}`
      })
      .join(', ')

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
  where(condition: SqlPredicate): this
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
    column:
      | string
      | Column<any, string>
      | SqlPredicate
      | ((eb: ExpressionBuilder) => ExpressionNode),
    op?: Operator,
    value?: unknown,
  ): this {
    this._where.push(toPredicate(column, op, value))
    return this
  }

  compile(): CompiledQuery {
    const bindings: Record<string, unknown> = {}

    const setClauses = Object.keys(this._set).map((k) => {
      const value = this._set[k]
      if (isSqlExpression(value)) return `${this.columnName(k)} = ${value.toSQL()}`
      const key = `s_${k}`
      bindings[key] = value
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
  where(condition: SqlPredicate): this
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
    column:
      | string
      | Column<any, string>
      | SqlPredicate
      | ((eb: ExpressionBuilder) => ExpressionNode),
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

type MergeReference = NamedRef & ExpressionNode & { toSQL(): string }

type MergeSource<TValues extends Record<string, unknown>> = {
  [TKey in keyof TValues]: MergeReference
}

type MergeTarget<TTable extends Table<any> | string | NamedRef> =
  TTable extends Table<any> ? TTable : { ref(name: string): MergeReference }

function mergeReference(name: string): MergeReference {
  return { kind: 'column', name, toSQL: () => name }
}

/** Oracle `MERGE` statement builder with a single-row `SELECT ... FROM dual` source. */
export class MergeQueryBuilder<
  TTable extends Table<any> | string | NamedRef = Table<any> | string | NamedRef,
  TSource extends Record<string, unknown> = Record<string, never>,
> {
  private _source?: Record<string, unknown>
  private _sourceAlias?: string
  private _on?: ExpressionNode
  private _matched?: Record<string, unknown>
  private _notMatched?: Record<string, unknown>
  private _schema?: string

  constructor(
    private readonly _table: TTable,
    private readonly _targetAlias?: string,
  ) {}

  resolveSchema(schema: string): this {
    this._schema = schema
    return this
  }

  private tableName(): string {
    if (typeof this._table === 'string') return this._table
    if (this._table instanceof Table) return this._table.queryName(this._schema)
    return this._schema ? `${this._schema}.${this._table.name}` : this._table.name
  }

  private columnName(key: string): string {
    return this._table instanceof Table ? this._table.columnNameForKey(key) : key
  }

  private targetAlias(): string {
    if (this._targetAlias) return this._targetAlias
    if (this._table instanceof Table && 'alias' in this._table) {
      return (this._table as Table<any> & { alias: string }).alias
    }
    return 'target'
  }

  private targetSql(): string {
    const table = this.tableName()
    return this._table instanceof Table && 'alias' in this._table
      ? table
      : `${table} ${this.targetAlias()}`
  }

  /** Define the single-row merge source and its SQL alias. */
  using<TValues extends Record<string, unknown>>(
    values: TValues,
    alias = 'source',
  ): MergeQueryBuilder<TTable, TValues> {
    this._source = { ...values }
    this._sourceAlias = alias
    return this as unknown as MergeQueryBuilder<TTable, TValues>
  }

  /** Reference a named field from the `using()` source. */
  sourceRef<TKey extends keyof TSource & string>(key: TKey): MergeReference {
    if (!this._sourceAlias) throw new Error('merge.sourceRef(): call using() first.')
    return mergeReference(`${this._sourceAlias}.${key}`)
  }

  /** Define the target/source matching predicate. */
  on(
    build: (
      target: MergeTarget<TTable>,
      source: MergeSource<TSource>,
      expression: ExpressionBuilder,
    ) => ExpressionNode | SqlPredicate,
  ): this {
    if (!this._sourceAlias) throw new Error('merge.on(): call using() first.')
    const source = Object.fromEntries(
      Object.keys(this._source ?? {}).map((key) => [key, this.sourceRef(key)]),
    ) as MergeSource<TSource>
    const target = (
      this._table instanceof Table
        ? this._table
        : { ref: (name: string) => mergeReference(`${this.targetAlias()}.${name}`) }
    ) as MergeTarget<TTable>
    const condition = build(target, source, odbExpr)
    this._on = isSqlExpression(condition)
      ? { kind: 'raw', sql: (condition as SqlPredicate).toQuerySQL?.() ?? condition.toSQL() }
      : condition
    return this
  }

  /** Set target fields when a matching source row exists. */
  whenMatched(
    values: TTable extends Table<any> ? Updateable<TTable> : Record<string, unknown>,
  ): this {
    this._matched = { ...values }
    return this
  }

  /** Insert a target row when no matching source row exists. */
  whenNotMatched(
    values: TTable extends Table<any> ? Insertable<TTable> : Record<string, unknown>,
  ): this {
    this._notMatched = { ...values }
    return this
  }

  private validate(): void {
    if (!this._source || !this._sourceAlias) throw new Error('merge: a source is required.')
    if (!this._on) throw new Error('merge: an ON predicate is required.')
    if (!this._matched && !this._notMatched) {
      throw new Error('merge: define whenMatched() or whenNotMatched().')
    }
  }

  private sourceSql(render: (value: unknown, key: string) => string): string {
    return Object.entries(this._source ?? {})
      .map(([key, value]) => `${render(value, key)} AS ${key}`)
      .join(', ')
  }

  private updateSql(render: (value: unknown, key: string) => string): string | undefined {
    if (!this._matched) return undefined
    return Object.entries(this._matched)
      .map(
        ([key, value]) => `${this.targetAlias()}.${this.columnName(key)} = ${render(value, key)}`,
      )
      .join(', ')
  }

  private insertSql(render: (value: unknown, key: string) => string): string | undefined {
    if (!this._notMatched) return undefined
    const keys = Object.keys(this._notMatched)
    const columns = keys.map((key) => this.columnName(key)).join(', ')
    const values = keys.map((key) => render(this._notMatched![key], key)).join(', ')
    return `(${columns}) VALUES (${values})`
  }

  compile(): CompiledQuery {
    this.validate()
    const bindings: Record<string, unknown> = {}
    const source = this.sourceSql((value, key) => {
      if (isSqlExpression(value)) return value.toSQL()
      const binding = `source_${key}`
      bindings[binding] = value
      return `:${binding}`
    })
    const renderWrite = (prefix: string) => (value: unknown, key: string) => {
      if (isSqlExpression(value)) return value.toSQL()
      const binding = `${prefix}_${key}`
      bindings[binding] = value
      return `:${binding}`
    }
    const context = new BindContext('m')
    const clauses = [
      `MERGE INTO ${this.targetSql()}`,
      `USING (SELECT ${source} FROM dual) ${this._sourceAlias}`,
      `ON (${compileNode(this._on!, context)})`,
    ]
    const update = this.updateSql(renderWrite('update'))
    if (update) clauses.push(`WHEN MATCHED THEN UPDATE SET ${update}`)
    const insert = this.insertSql(renderWrite('insert'))
    if (insert) clauses.push(`WHEN NOT MATCHED THEN INSERT ${insert}`)
    Object.assign(bindings, context.bindings)
    return { sql: clauses.join(' '), bindings }
  }

  toSQL(): string {
    this.validate()
    const source = this.sourceSql((value) => inlineValue(value))
    const clauses = [
      `MERGE INTO ${this.targetSql()}`,
      `USING (SELECT ${source} FROM dual) ${this._sourceAlias}`,
      `ON (${renderNode(this._on!)})`,
    ]
    const update = this.updateSql((value) => inlineValue(value))
    if (update) clauses.push(`WHEN MATCHED THEN UPDATE SET ${update}`)
    const insert = this.insertSql((value) => inlineValue(value))
    if (insert) clauses.push(`WHEN NOT MATCHED THEN INSERT ${insert}`)
    return clauses.join(' ')
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

  mergeInto<TTable extends Table<any>>(
    table: TTable,
    targetAlias?: string,
  ): MergeQueryBuilder<TTable>
  mergeInto(table: string | NamedRef, targetAlias?: string): MergeQueryBuilder<string | NamedRef>
  mergeInto(table: string | NamedRef | Table<any>, targetAlias?: string): MergeQueryBuilder<any> {
    return new MergeQueryBuilder(table as string | NamedRef, targetAlias)
  }
}

export function odbQuery(): OdbQuery {
  return new OdbQuery()
}
