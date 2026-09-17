import type { OdbType } from '../model.js'

export type PlsqlType =
  | 'VARCHAR2'
  | 'PLS_INTEGER'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'SYS_REFCURSOR'
  | 'CLOB'
  | 'BLOB'
  | 'INTEGER'
  | 'BINARY_INTEGER'
  | 'TIMESTAMP'

export type ParameterDirection = 'IN' | 'OUT' | 'IN OUT'

/** A typed PL/SQL value that can be rendered into generated source. */
export interface PlsqlValue<T extends PlsqlType | string = PlsqlType | string> {
  readonly type: T
  toSQL(): string
}

/** A named PL/SQL value, such as a procedure parameter or local variable. */
export interface PlsqlReference<
  T extends PlsqlType | string = PlsqlType | string,
> extends PlsqlValue<T> {
  readonly name: string
}

/** A typed PL/SQL expression produced by a builder helper. */
export class PlsqlExpression<T extends PlsqlType | string> implements PlsqlValue<T> {
  constructor(
    readonly type: T,
    private readonly sql: string,
  ) {}

  toSQL(): string {
    return this.sql
  }
}

/** A typed PL/SQL predicate suitable for control-flow conditions. */
class PlsqlBooleanExpressionImpl extends PlsqlExpression<'BOOLEAN'> {
  and(...conditions: PlsqlBooleanExpression[]): PlsqlBooleanExpression {
    return cond.and([this, ...conditions])
  }

  or(...conditions: PlsqlBooleanExpression[]): PlsqlBooleanExpression {
    return cond.or([this, ...conditions])
  }

  not(): PlsqlBooleanExpression {
    return cond.not(this)
  }
}

export type PlsqlBooleanExpression = PlsqlBooleanExpressionImpl

/** A typed PL/SQL statement produced by a procedure-call wrapper. */
export class PlsqlStatement {
  constructor(private readonly sql: string) {}

  toSQL(): string {
    return this.sql
  }
}

export type PlsqlRenderable = string | PlsqlValue

export function renderPlsql(value: PlsqlRenderable): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'toSQL' in value && typeof value.toSQL === 'function') {
    return value.toSQL()
  }
  return String(value)
}

/**
 * Build a typed PL/SQL literal expression. Strings are safely single-quoted
 * (embedded quotes doubled); numbers render as-is.
 *
 * @example
 * odbLiteral('APP_VERSION') // → 'APP_VERSION' (VARCHAR2)
 * odbLiteral(42)            // → 42 (NUMBER)
 */
export function odbLiteral(value: string): PlsqlExpression<'VARCHAR2'>
export function odbLiteral(value: number): PlsqlExpression<'NUMBER'>
export function odbLiteral(
  value: string | number,
): PlsqlExpression<'VARCHAR2'> | PlsqlExpression<'NUMBER'> {
  return typeof value === 'number'
    ? new PlsqlExpression('NUMBER', String(value))
    : new PlsqlExpression('VARCHAR2', `'${value.replace(/'/g, "''")}'`)
}

export type PlsqlExpressionValue = PlsqlValue | string | number | boolean | null

function renderExpressionValue(value: PlsqlExpressionValue): string {
  if (typeof value === 'string') return odbLiteral(value).toSQL()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value === null) return 'NULL'
  return value.toSQL()
}

function condition(sql: string): PlsqlBooleanExpression {
  return new PlsqlBooleanExpressionImpl('BOOLEAN', sql)
}

/** Typed predicates for PL/SQL control flow. */
export const cond = {
  eq(left: PlsqlValue, right: PlsqlExpressionValue): PlsqlBooleanExpression {
    return condition(`${left.toSQL()} = ${renderExpressionValue(right)}`)
  },
  ne(left: PlsqlValue, right: PlsqlExpressionValue): PlsqlBooleanExpression {
    return condition(`${left.toSQL()} != ${renderExpressionValue(right)}`)
  },
  gt(left: PlsqlValue, right: PlsqlExpressionValue): PlsqlBooleanExpression {
    return condition(`${left.toSQL()} > ${renderExpressionValue(right)}`)
  },
  gte(left: PlsqlValue, right: PlsqlExpressionValue): PlsqlBooleanExpression {
    return condition(`${left.toSQL()} >= ${renderExpressionValue(right)}`)
  },
  lt(left: PlsqlValue, right: PlsqlExpressionValue): PlsqlBooleanExpression {
    return condition(`${left.toSQL()} < ${renderExpressionValue(right)}`)
  },
  lte(left: PlsqlValue, right: PlsqlExpressionValue): PlsqlBooleanExpression {
    return condition(`${left.toSQL()} <= ${renderExpressionValue(right)}`)
  },
  isNull(value: PlsqlValue): PlsqlBooleanExpression {
    return condition(`${value.toSQL()} IS NULL`)
  },
  isNotNull(value: PlsqlValue): PlsqlBooleanExpression {
    return condition(`${value.toSQL()} IS NOT NULL`)
  },
  regexpLike(value: PlsqlValue, pattern: string): PlsqlBooleanExpression {
    return condition(`REGEXP_LIKE(${value.toSQL()}, ${renderExpressionValue(pattern)})`)
  },
  not(value: PlsqlBooleanExpression): PlsqlBooleanExpression {
    return condition(`NOT (${value.toSQL()})`)
  },
  and(values: readonly PlsqlBooleanExpression[]): PlsqlBooleanExpression {
    return condition(`(${values.map((value) => value.toSQL()).join(' AND ')})`)
  },
  or(values: readonly PlsqlBooleanExpression[]): PlsqlBooleanExpression {
    return condition(`(${values.map((value) => value.toSQL()).join(' OR ')})`)
  },
}

/** Typed value expressions that compose with assignments, returns, and conditions. */
export const plsqlExpr = {
  /** Explicitly treat a compatible expression as the requested PL/SQL type. */
  cast<T extends PlsqlType | string>(value: PlsqlValue): PlsqlExpression<T> {
    return new PlsqlExpression(value.type as T, value.toSQL())
  },
  call<T extends PlsqlType | string>(
    type: T,
    name: string,
    ...args: PlsqlRenderable[]
  ): PlsqlExpression<T> {
    return new PlsqlExpression(type, `${name}(${args.map(renderPlsql).join(', ')})`)
  },
  add<T extends PlsqlType | string>(
    left: PlsqlValue<T>,
    right: PlsqlExpressionValue,
  ): PlsqlExpression<T> {
    return new PlsqlExpression(
      left.type,
      `${renderExpressionValue(left)} + ${renderExpressionValue(right)}`,
    )
  },
  subtract(left: PlsqlExpressionValue, right: PlsqlExpressionValue): PlsqlExpression<'NUMBER'> {
    return new PlsqlExpression(
      'NUMBER',
      `${renderExpressionValue(left)} - ${renderExpressionValue(right)}`,
    )
  },
  multiply(left: PlsqlExpressionValue, right: PlsqlExpressionValue): PlsqlExpression<'NUMBER'> {
    return new PlsqlExpression(
      'NUMBER',
      `${renderExpressionValue(left)} * ${renderExpressionValue(right)}`,
    )
  },
  divide(left: PlsqlExpressionValue, right: PlsqlExpressionValue): PlsqlExpression<'NUMBER'> {
    return new PlsqlExpression(
      'NUMBER',
      `${renderExpressionValue(left)} / ${renderExpressionValue(right)}`,
    )
  },
  concat(...values: PlsqlExpressionValue[]): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression('VARCHAR2', values.map(renderExpressionValue).join(' || '))
  },
  jsonObject<T extends PlsqlType | string = 'CLOB'>(
    values: Record<string, PlsqlExpressionValue>,
    type: T = 'CLOB' as T,
  ): PlsqlExpression<T> {
    const entries = Object.entries(values).map(
      ([key, value]) => `${renderExpressionValue(key)} VALUE ${renderExpressionValue(value)}`,
    )
    return new PlsqlExpression(type, `JSON_OBJECT(${entries.join(', ')} RETURNING ${type})`)
  },
  interval(value: PlsqlExpressionValue, unit: string): PlsqlExpression<'INTERVAL DAY TO SECOND'> {
    return new PlsqlExpression(
      'INTERVAL DAY TO SECOND',
      `NUMTODSINTERVAL(${renderExpressionValue(value)}, ${renderExpressionValue(unit)})`,
    )
  },
}

/** @deprecated Use plsqlExpr. */
export const expr = plsqlExpr

export type ParamOptions = {
  length?: number
  default?: string
}

export type ParamNode = {
  kind: 'param'
  name: string
  type: PlsqlType | string
  odbType?: OdbType
  direction: ParameterDirection
  options: ParamOptions
}

export class Param<T extends PlsqlType | string = PlsqlType | string> implements PlsqlReference<T> {
  private _direction: ParameterDirection
  private options: ParamOptions

  constructor(
    readonly name: string,
    readonly type: T,
    direction: ParameterDirection = 'IN',
    options: ParamOptions = {},
    readonly odbType?: OdbType,
  ) {
    this._direction = direction
    this.options = { ...options }
  }

  in(): this {
    this._direction = 'IN'
    return this
  }

  out(): this {
    this._direction = 'OUT'
    return this
  }

  inOut(): this {
    this._direction = 'IN OUT'
    return this
  }

  toSQL(): string {
    return this.name
  }

  length(n: number): this {
    this.options.length = n
    return this
  }

  default(val: string): this {
    this.options.default = val
    return this
  }

  toNode(): ParamNode {
    return {
      kind: 'param',
      name: this.name,
      type: this.type,
      odbType: this.odbType,
      direction: this._direction,
      options: { ...this.options },
    }
  }
}

export type LocalVarOptions = {
  length?: number
  value?: string
}

export type LocalVarNode = {
  kind: 'localvar'
  name: string
  type: PlsqlType | string
  options: LocalVarOptions
}

export class LocalVar<
  T extends PlsqlType | string = PlsqlType | string,
> implements PlsqlReference<T> {
  private options: LocalVarOptions

  constructor(
    readonly name: string,
    readonly type: T,
    options: LocalVarOptions = {},
  ) {
    this.options = { ...options }
  }

  toSQL(): string {
    return this.name
  }

  toNode(): LocalVarNode {
    return {
      kind: 'localvar',
      name: this.name,
      type: this.type,
      options: { ...this.options },
    }
  }
}

// ── Typed LocalVar subclasses (Option B: type-aware handles) ────────────────
//
// These extend LocalVar with PL/SQL expression helpers whose implementation
// lives in the pre-installed `odb_lob` package. Each helper returns a
// PL/SQL expression that can be passed to `body.set(target, expr)`.
//
// Kept alongside LocalVar (rather than in packages/framework/lob/lob.ts) so
// `ProcedureBody` can dispatch on the type literal without introducing a
// schema→packages import cycle. The `odb_lob.*` strings are duplicated in
// `packages/framework/lob/lob.ts` — trivial duplication kept intentionally.

export class ClobVar extends LocalVar<'CLOB'> {
  /** `odb_lob.clob_to_base64(<this>)` — returns CLOB. */
  toBase64(): PlsqlExpression<'CLOB'> {
    return new PlsqlExpression('CLOB', `odb_lob.clob_to_base64(${this.name})`)
  }
  /** `odb_lob.clob_to_blob(<this>)` — returns BLOB. */
  toBlob(): PlsqlExpression<'BLOB'> {
    return new PlsqlExpression('BLOB', `odb_lob.clob_to_blob(${this.name})`)
  }
}

export class BlobVar extends LocalVar<'BLOB'> {
  /** `odb_lob.blob_to_base64(<this>)` — returns CLOB. */
  toBase64(): PlsqlExpression<'CLOB'> {
    return new PlsqlExpression('CLOB', `odb_lob.blob_to_base64(${this.name})`)
  }
  /** `odb_lob.blob_to_clob(<this>)` — returns CLOB. */
  toClob(): PlsqlExpression<'CLOB'> {
    return new PlsqlExpression('CLOB', `odb_lob.blob_to_clob(${this.name})`)
  }
}

export class Varchar2Var extends LocalVar<'VARCHAR2'> {
  /** `odb_lob.varchar2_to_base64(<this>)` — returns CLOB. */
  toBase64(): PlsqlExpression<'CLOB'> {
    return new PlsqlExpression('CLOB', `odb_lob.varchar2_to_base64(${this.name})`)
  }
}

export function emitPlsqlType(type: PlsqlType | string, options: { length?: number } = {}): string {
  switch (type as PlsqlType) {
    case 'VARCHAR2':
      return `VARCHAR2(${options.length ?? 32767})`
    case 'PLS_INTEGER':
      return 'PLS_INTEGER'
    case 'NUMBER':
      return 'NUMBER'
    case 'DATE':
      return 'DATE'
    case 'BOOLEAN':
      return 'BOOLEAN'
    case 'SYS_REFCURSOR':
      return 'SYS_REFCURSOR'
    case 'CLOB':
      return 'CLOB'
    case 'BLOB':
      return 'BLOB'
    case 'INTEGER':
      return 'INTEGER'
    case 'BINARY_INTEGER':
      return 'BINARY_INTEGER'
    case 'TIMESTAMP':
      return 'TIMESTAMP'
    default:
      return options.length === undefined ? type : `${type}(${options.length})`
  }
}

/**
 * Emit a PL/SQL type for use in a procedure/function signature (parameters and
 * RETURN types). Oracle does NOT allow length qualifiers in these positions.
 */
export function emitParamType(type: PlsqlType | string): string {
  if ((type as PlsqlType) === 'VARCHAR2') return 'VARCHAR2'
  return emitPlsqlType(type)
}

export function emitParamDef(param: ParamNode): string {
  const parts: string[] = [param.name, param.direction, emitParamType(param.type)]
  if (param.options.default !== undefined) {
    parts.push(`DEFAULT ${param.options.default}`)
  }
  return parts.join(' ')
}

export function emitLocalVarDecl(v: LocalVarNode): string {
  const typePart = emitPlsqlType(v.type, v.options)
  if (v.options.value !== undefined) {
    return `${v.name} ${typePart} := ${v.options.value};`
  }
  return `${v.name} ${typePart};`
}
