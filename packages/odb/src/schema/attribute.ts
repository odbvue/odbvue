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

export type PlsqlRenderable = string | PlsqlValue

export function renderPlsql(value: PlsqlRenderable): string {
  return typeof value === 'string' ? value : value.toSQL()
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

export type ParamOptions = {
  length?: number
  default?: string
}

export type ParamNode = {
  kind: 'param'
  name: string
  type: PlsqlType | string
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
      direction: this._direction,
      options: { ...this.options },
    }
  }

  toObject() {
    return this.toNode()
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

  length(n: number): this {
    this.options.length = n
    return this
  }

  assign(val: PlsqlRenderable): this {
    this.options.value = renderPlsql(val)
    return this
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

  toObject() {
    return this.toNode()
  }
}

// ── Typed LocalVar subclasses (Option B: type-aware handles) ────────────────
//
// These extend LocalVar with PL/SQL expression helpers whose implementation
// lives in the pre-installed `pck_api_lob` package. Each helper returns a
// PL/SQL expression string that can be passed to `body.assign(target, expr)`.
//
// Kept alongside LocalVar (rather than in api/lob/lob.ts) so `ProcedureBody`
// can dispatch on the type literal without introducing a schema→api import
// cycle. The `pck_api_lob.*` strings are duplicated in `api/lob/lob.ts`
// (Option A functional helpers) — trivial duplication kept intentionally.

export class ClobVar extends LocalVar<'CLOB'> {
  /** `pck_api_lob.clob_to_base64(<this>)` — returns CLOB. */
  toBase64(): PlsqlExpression<'CLOB'> {
    return new PlsqlExpression('CLOB', `pck_api_lob.clob_to_base64(${this.name})`)
  }
  /** `pck_api_lob.clob_to_blob(<this>)` — returns BLOB. */
  toBlob(): PlsqlExpression<'BLOB'> {
    return new PlsqlExpression('BLOB', `pck_api_lob.clob_to_blob(${this.name})`)
  }
}

export class BlobVar extends LocalVar<'BLOB'> {
  /** `pck_api_lob.blob_to_base64(<this>)` — returns CLOB. */
  toBase64(): PlsqlExpression<'CLOB'> {
    return new PlsqlExpression('CLOB', `pck_api_lob.blob_to_base64(${this.name})`)
  }
  /** `pck_api_lob.blob_to_clob(<this>)` — returns CLOB. */
  toClob(): PlsqlExpression<'CLOB'> {
    return new PlsqlExpression('CLOB', `pck_api_lob.blob_to_clob(${this.name})`)
  }
}

export class Varchar2Var extends LocalVar<'VARCHAR2'> {
  /** Assign a safely quoted VARCHAR2 literal as the variable's initial value. */
  value(value: string): this {
    return this.assign(`'${value.replace(/'/g, "''")}'`)
  }

  /** `pck_api_lob.varchar2_to_base64(<this>)` — returns CLOB. */
  toBase64(): PlsqlExpression<'CLOB'> {
    return new PlsqlExpression('CLOB', `pck_api_lob.varchar2_to_base64(${this.name})`)
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
      return type
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
