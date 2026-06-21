export type ComparisonOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'LIKE'
export type NullOperator = 'IS NULL' | 'IS NOT NULL'
export type Operator = ComparisonOperator | NullOperator

type WhereCondition = {
  column: string
  op: Operator
  value?: unknown
}

type OrderByClause = {
  column: string
  direction: 'asc' | 'desc'
}

export type CompiledQuery = {
  sql: string
  bindings: Record<string, unknown>
}

function inlineValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (v instanceof Date) {
    const iso = v.toISOString().replace('T', ' ').substring(0, 19)
    return `TO_TIMESTAMP('${iso}', 'YYYY-MM-DD HH24:MI:SS')`
  }
  return `'${String(v).replace(/'/g, "''")}'`
}

function buildWhereInline(conditions: WhereCondition[]): string {
  return conditions
    .map((w) => {
      if (w.op === 'IS NULL' || w.op === 'IS NOT NULL') return `${w.column} ${w.op}`
      return `${w.column} ${w.op} ${inlineValue(w.value)}`
    })
    .join(' AND ')
}

function buildWhereClause(conditions: WhereCondition[], bindings: Record<string, unknown>): string {
  const parts = conditions.map((w, i) => {
    if (w.op === 'IS NULL' || w.op === 'IS NOT NULL') {
      return `${w.column} ${w.op}`
    }
    const key = `w${i}`
    bindings[key] = w.value
    return `${w.column} ${w.op} :${key}`
  })
  return parts.join(' AND ')
}

export class SelectQueryBuilder {
  private _columns: string[] = []
  private _where: WhereCondition[] = []
  private _orderBy: OrderByClause[] = []
  private _limit?: number

  constructor(private readonly _table: string) {}

  select(columns: string | string[]): this {
    const cols = Array.isArray(columns) ? columns : [columns]
    this._columns.push(...cols)
    return this
  }

  where(column: string, op: Operator, value?: unknown): this {
    this._where.push({ column, op, value })
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

  compile(): CompiledQuery {
    const bindings: Record<string, unknown> = {}
    const cols = this._columns.length > 0 ? this._columns.join(', ') : '*'
    let sql = `SELECT ${cols} FROM ${this._table}`

    if (this._where.length > 0) {
      sql += ` WHERE ${buildWhereClause(this._where, bindings)}`
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
    let sql = `SELECT ${cols} FROM ${this._table}`
    if (this._where.length > 0) sql += ` WHERE ${buildWhereInline(this._where)}`
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

  constructor(private readonly _table: string) {}

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
      sql: `INSERT INTO ${this._table} (${cols}) VALUES (${vals})`,
      bindings,
    }
  }

  toSQL(): string {
    const keys = Object.keys(this._values)
    const cols = keys.join(', ')
    const vals = keys.map((k) => inlineValue(this._values[k])).join(', ')
    return `INSERT INTO ${this._table} (${cols}) VALUES (${vals})`
  }
}

export class UpdateQueryBuilder {
  private _set: Record<string, unknown> = {}
  private _where: WhereCondition[] = []

  constructor(private readonly _table: string) {}

  set(values: Record<string, unknown>): this {
    this._set = { ...values }
    return this
  }

  where(column: string, op: Operator, value?: unknown): this {
    this._where.push({ column, op, value })
    return this
  }

  compile(): CompiledQuery {
    const bindings: Record<string, unknown> = {}

    const setClauses = Object.keys(this._set).map((k) => {
      const key = `s_${k}`
      bindings[key] = this._set[k]
      return `${k} = :${key}`
    })

    let sql = `UPDATE ${this._table} SET ${setClauses.join(', ')}`

    if (this._where.length > 0) {
      sql += ` WHERE ${buildWhereClause(this._where, bindings)}`
    }

    return { sql, bindings }
  }

  toSQL(): string {
    const setClauses = Object.keys(this._set).map((k) => `${k} = ${inlineValue(this._set[k])}`)
    let sql = `UPDATE ${this._table} SET ${setClauses.join(', ')}`
    if (this._where.length > 0) sql += ` WHERE ${buildWhereInline(this._where)}`
    return sql
  }
}

export class DeleteQueryBuilder {
  private _where: WhereCondition[] = []

  constructor(private readonly _table: string) {}

  where(column: string, op: Operator, value?: unknown): this {
    this._where.push({ column, op, value })
    return this
  }

  compile(): CompiledQuery {
    const bindings: Record<string, unknown> = {}
    let sql = `DELETE FROM ${this._table}`

    if (this._where.length > 0) {
      sql += ` WHERE ${buildWhereClause(this._where, bindings)}`
    }

    return { sql, bindings }
  }

  toSQL(): string {
    let sql = `DELETE FROM ${this._table}`
    if (this._where.length > 0) sql += ` WHERE ${buildWhereInline(this._where)}`
    return sql
  }
}

export class OdbQuery {
  selectFrom(table: string): SelectQueryBuilder {
    return new SelectQueryBuilder(table)
  }

  insertInto(table: string): InsertQueryBuilder {
    return new InsertQueryBuilder(table)
  }

  updateTable(table: string): UpdateQueryBuilder {
    return new UpdateQueryBuilder(table)
  }

  deleteFrom(table: string): DeleteQueryBuilder {
    return new DeleteQueryBuilder(table)
  }
}

export function odbQuery(): OdbQuery {
  return new OdbQuery()
}
