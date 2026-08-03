import { Column } from '../schema/column.js'
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

export class SelectQueryBuilder {
  private _columns: string[] = []
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

  select(columns: SqlExpr | SqlExpr[]): this {
    const cols = Array.isArray(columns) ? columns : [columns]
    this._columns.push(...cols.map(exprSql))
    return this
  }

  where(build: (eb: ExpressionBuilder) => ExpressionNode): this
  where<TValue, TName extends string>(
    column: Column<TValue, TName>,
    op: ComparisonOperator,
    value: TValue,
  ): this
  where<TName extends string>(
    column: Column<unknown, TName>,
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

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this._orderBy.push({ column, direction })
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

export class InsertQueryBuilder {
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

  values(row: Record<string, unknown>): this {
    this._values = { ...row }
    return this
  }

  compile(): CompiledQuery {
    const keys = Object.keys(this._values)
    const bindings: Record<string, unknown> = {}
    for (const k of keys) bindings[k] = this._values[k]

    const cols = keys.join(', ')
    const vals = keys.map((k) => `:${k}`).join(', ')

    return {
      sql: `INSERT INTO ${this.tableName()} (${cols}) VALUES (${vals})`,
      bindings,
    }
  }

  toSQL(): string {
    const keys = Object.keys(this._values)
    const cols = keys.join(', ')
    const vals = keys.map((k) => inlineValue(this._values[k])).join(', ')
    return `INSERT INTO ${this.tableName()} (${cols}) VALUES (${vals})`
  }
}

export class UpdateQueryBuilder {
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

  set(values: Record<string, unknown>): this {
    this._set = { ...values }
    return this
  }

  where(build: (eb: ExpressionBuilder) => ExpressionNode): this
  where<TValue, TName extends string>(
    column: Column<TValue, TName>,
    op: ComparisonOperator,
    value: TValue,
  ): this
  where<TName extends string>(
    column: Column<unknown, TName>,
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
      return `${k} = :${key}`
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
    const setClauses = Object.keys(this._set).map((k) => `${k} = ${inlineValue(this._set[k])}`)
    let sql = `UPDATE ${this.tableName()} SET ${setClauses.join(', ')}`
    const whereNode = combinePredicates(this._where)
    if (whereNode) sql += ` WHERE ${renderNode(whereNode)}`
    return sql
  }
}

export class DeleteQueryBuilder {
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
  where<TValue, TName extends string>(
    column: Column<TValue, TName>,
    op: ComparisonOperator,
    value: TValue,
  ): this
  where<TName extends string>(
    column: Column<unknown, TName>,
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
  selectFrom(table: string | NamedRef): SelectQueryBuilder {
    return new SelectQueryBuilder(table)
  }

  insertInto(table: string | NamedRef): InsertQueryBuilder {
    return new InsertQueryBuilder(table)
  }

  updateTable(table: string | NamedRef): UpdateQueryBuilder {
    return new UpdateQueryBuilder(table)
  }

  deleteFrom(table: string | NamedRef): DeleteQueryBuilder {
    return new DeleteQueryBuilder(table)
  }
}

export function odbQuery(): OdbQuery {
  return new OdbQuery()
}
