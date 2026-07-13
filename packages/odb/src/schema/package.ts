import {
  BlobVar,
  ClobVar,
  LocalVar,
  Param,
  Varchar2Var,
  type LocalVarNode,
  type ParamNode,
  type ParameterDirection,
  type PlsqlReference,
  type PlsqlRenderable,
  type PlsqlType,
  type PlsqlValue,
  emitLocalVarDecl,
  emitParamDef,
  emitParamType,
  renderPlsql,
} from './attribute.js'
import { OrdsEndpoint, type OrdsHttpMethod, type OrdsParamType } from '../ords.js'

// ── Query builder integration ─────────────────────────────────────────────────

/** Any query builder that can emit a SQL string (SelectQueryBuilder, InsertQueryBuilder, etc.) */
export type AnyQueryBuilder = { toSQL(): string }

// ── Statement types ──────────────────────────────────────────────────────────

export type StatementNode =
  | { kind: 'assign'; target: string; value: string }
  | { kind: 'return'; value?: string }
  | { kind: 'null' }
  | { kind: 'raw'; sql: string }

// ── AST node types ───────────────────────────────────────────────────────────

export type ProcedureBodyNode = {
  declarations: LocalVarNode[]
  statements: StatementNode[]
}

export type ProcedureNode = {
  kind: 'procedure'
  name: string
  params: ParamNode[]
  body?: ProcedureBodyNode
}

export type FunctionNode = {
  kind: 'function'
  name: string
  params: ParamNode[]
  returnType: PlsqlType | string
  returnTypeOptions: { length?: number }
  body?: ProcedureBodyNode
}

export type PackageNode = {
  kind: 'package'
  name: string
  procedures: ProcedureNode[]
  functions: FunctionNode[]
}

export type PackageSqlOptions = {
  schema?: string
  orReplace?: boolean
}

// ── ProcedureBody ─────────────────────────────────────────────────────────────

export class ProcedureBody {
  private _declarations: LocalVar[] = []
  private _statements: StatementNode[] = []

  /**
   * Declare a local variable. Returns the LocalVar so you can chain
   * `.assign(value)` or `.length(n)` on it.
   *
   * The concrete return type depends on the PL/SQL type literal:
   * - `'CLOB'`   → `ClobVar`  (with `.toBase64()`, `.toBlob()`)
   * - `'BLOB'`   → `BlobVar`  (with `.toBase64()`, `.toClob()`)
   * - `'VARCHAR2'` → `Varchar2Var` (with `.toBase64()`)
   * - anything else → plain `LocalVar`
   *
   * @example
   * body.variable('v_name', 'VARCHAR2', 100).assign("'hello'")
   * body.variable('v_lob', 'CLOB').assign("'text'")
   * body.assign('v_out', body.variable('v_lob', 'CLOB').toBase64())
   */
  variable(name: string, type: 'CLOB', length?: number): ClobVar
  variable(name: string, type: 'BLOB', length?: number): BlobVar
  variable(name: string, type: 'VARCHAR2', length?: number): Varchar2Var
  variable<T extends PlsqlType | string>(name: string, type: T, length?: number): LocalVar<T>
  variable(name: string, type: PlsqlType | string, length?: number): LocalVar {
    const opts = length !== undefined ? { length } : {}
    const v =
      type === 'CLOB'
        ? new ClobVar(name, type, opts)
        : type === 'BLOB'
          ? new BlobVar(name, type, opts)
          : type === 'VARCHAR2'
            ? new Varchar2Var(name, type, opts)
            : new LocalVar(name, type, opts)
    this._declarations.push(v)
    return v
  }

  /** Declare a VARCHAR2 variable using the type-specific fluent API. */
  varchar2(name: string, length?: number): Varchar2Var {
    return this.variable(name, 'VARCHAR2', length)
  }

  /** Declare a CLOB variable using the type-specific fluent API. */
  clob(name: string): ClobVar {
    return this.variable(name, 'CLOB')
  }

  /** Declare a BLOB variable using the type-specific fluent API. */
  blob(name: string): BlobVar {
    return this.variable(name, 'BLOB')
  }

  /** `target := value;` */
  assign(target: string | PlsqlReference, value: PlsqlRenderable): this {
    this._statements.push({
      kind: 'assign',
      target: typeof target === 'string' ? target : target.toSQL(),
      value: renderPlsql(value),
    })
    return this
  }

  /**
   * Assign one typed PL/SQL value to another. Unlike `assign()`, this rejects
   * incompatible typed references and expressions at compile time.
   */
  set<T extends PlsqlType | string>(
    target: PlsqlReference<T>,
    value: PlsqlValue<NoInfer<T>>,
  ): this {
    this._statements.push({
      kind: 'assign',
      target: target.toSQL(),
      value: value.toSQL(),
    })
    return this
  }

  /** `RETURN [value];` */
  return(value?: string): this {
    this._statements.push({ kind: 'return', value })
    return this
  }

  /** `NULL;` */
  null(): this {
    this._statements.push({ kind: 'null' })
    return this
  }

  /** Emit an arbitrary SQL statement as-is. */
  raw(sql: string): this {
    this._statements.push({ kind: 'raw', sql })
    return this
  }

  /**
   * Execute a query builder statement (INSERT, UPDATE, DELETE, or standalone SELECT).
   * Calls `.toSQL()` on the builder and emits the result as a statement.
   *
   * @example
   * body.query(from('employees').insert().values({ name: 'Alice' }))
   */
  query(qb: AnyQueryBuilder): this {
    this._statements.push({ kind: 'raw', sql: qb.toSQL() })
    return this
  }

  /**
   * Emit `OPEN <cursor> FOR <select query>;`
   *
   * @example
   * body.openFor('p_cursor', select('employees').columns(['id', 'name']))
   */
  openFor(cursor: string, qb: AnyQueryBuilder): this {
    this._statements.push({ kind: 'raw', sql: `OPEN ${cursor} FOR ${qb.toSQL()}` })
    return this
  }

  toNode(): ProcedureBodyNode {
    return {
      declarations: this._declarations.map((v) => v.toNode()),
      statements: [...this._statements],
    }
  }
}

// ── Procedure ─────────────────────────────────────────────────────────────────

/**
 * Maps a PL/SQL type to the nearest ORDS parameter type.
 * https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/18.3/aelig/ords-database-type-mappings.html
 */
function plsqlToOrdsType(type: PlsqlType | string): OrdsParamType {
  switch (type as PlsqlType) {
    case 'SYS_REFCURSOR':
      return 'RESULTSET'
    case 'PLS_INTEGER':
    case 'INTEGER':
    case 'BINARY_INTEGER':
      return 'INT'
    case 'DATE':
    case 'TIMESTAMP':
      return 'TIMESTAMP'
    case 'BOOLEAN':
      return 'BOOLEAN'
    default:
      return 'STRING'
  }
}

/**
 * Derive an ORDS module name from a PL/SQL package name.
 * Strips a leading PCK_/PKG_ prefix, lowercases, replaces _ with -.
 * e.g. PCK_USER_ADMIN → user-admin
 */
function deriveOrdsModule(packageName: string): string {
  let name = packageName.toUpperCase()
  for (const prefix of ['PCK_', 'PKG_']) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length)
      break
    }
  }
  return name.toLowerCase().replace(/_/g, '-')
}

function normalizeServicePath(path: string): string {
  return path.trim().replace(/^\/+|\/+$/g, '')
}

function normalizeBasePath(path: string): string {
  const normalized = normalizeServicePath(path)
  return normalized ? `${normalized}/` : '/'
}

/** Explicit public ORDS contract for a package procedure. */
export type OrdsServiceDefinition = {
  /** HTTP method exposed by ORDS. */
  method: OrdsHttpMethod
  /** Route within the module, written as an application-style path such as `/users/:id`. */
  path: string
  /** Human-readable endpoint description stored in the ORDS catalogue. */
  summary?: string
  /** ORDS module name. Defaults to the package-derived module name. */
  module?: string
  /** ORDS module base path. Defaults to `<module>/`. */
  basePath?: string
  /** Overrides for automatically mapped ORDS parameter types, keyed by PL/SQL argument name. */
  paramTypes?: Record<string, OrdsParamType>
}

/**
 * Fluent builder for the ORDS configuration of a single procedure.
 * Obtained via `proc.ords(build?)` — all settings are optional overrides;
 * sensible defaults are derived from the package/procedure name and parameters.
 */
export class OrdsEndpointBuilder {
  private _module?: string
  private _basePath?: string
  private _method?: OrdsHttpMethod
  private _pattern?: string
  private _comment?: string
  private _typeOverrides = new Map<string, OrdsParamType>()

  /** Override the module name (default: derived from the package name). */
  module(name: string): this {
    this._module = name
    return this
  }

  /** Override the module base path (default: `<module>/`). */
  basePath(path: string): this {
    this._basePath = path
    return this
  }

  /** Override the HTTP method (default: inferred from procedure name prefix). */
  method(m: OrdsHttpMethod): this {
    this._method = m
    return this
  }

  /** Override the URL pattern (default: derived from procedure name + IN params). */
  pattern(p: string): this {
    this._pattern = p
    return this
  }

  comment(c: string): this {
    this._comment = c
    return this
  }

  /**
   * Override the ORDS type for a specific PL/SQL argument.
   * Useful when the auto-mapped type (e.g. STRING for NUMBER) isn't right.
   */
  paramType(plsqlArg: string, type: OrdsParamType): this {
    this._typeOverrides.set(plsqlArg.toUpperCase(), type)
    return this
  }

  /** @internal Called by Package when building ORDS SQL. */
  build(packageName: string, procedureName: string, params: Param[]): OrdsEndpoint {
    const module = this._module ?? deriveOrdsModule(packageName)
    const endpoint = new OrdsEndpoint(module, packageName, procedureName)
    if (this._basePath !== undefined) endpoint.basePath(this._basePath)
    if (this._method) endpoint.method(this._method)
    if (this._pattern !== undefined) endpoint.pattern(this._pattern)
    if (this._comment) endpoint.comment(this._comment)

    for (const p of params) {
      const node = p.toNode()
      const ordsType =
        this._typeOverrides.get(node.name.toUpperCase()) ?? plsqlToOrdsType(node.type)
      endpoint.param(node.name, node.direction as 'IN' | 'OUT' | 'IN OUT', ordsType)
    }

    return endpoint
  }
}

// ── Procedure ─────────────────────────────────────────────────────────────────

export class Procedure {
  private _params: Param[] = []
  private _body?: ProcedureBody
  private _ordsBuilder?: OrdsEndpointBuilder

  constructor(readonly name: string) {}

  /** Add a parameter (default direction IN). */
  param<T extends PlsqlType | string>(
    name: string,
    type: T,
    direction: ParameterDirection = 'IN',
  ): Param<T> {
    const p = new Param(name, type, direction)
    this._params.push(p)
    return p
  }

  /** Shorthand: add an IN parameter. */
  in<T extends PlsqlType | string>(name: string, type: T): Param<T> {
    return this.param(name, type, 'IN')
  }

  /** Shorthand: add an OUT parameter. */
  out<T extends PlsqlType | string>(name: string, type: T): Param<T> {
    return this.param(name, type, 'OUT')
  }

  /** Shorthand: add an IN OUT parameter. */
  inOut<T extends PlsqlType | string>(name: string, type: T): Param<T> {
    return this.param(name, type, 'IN OUT')
  }

  /**
   * Define the procedure body (local variables + executable statements).
   * If omitted the body will emit `NULL;`.
   */
  body(build: (body: ProcedureBody) => void): this {
    this._body = new ProcedureBody()
    build(this._body)
    return this
  }

  /**
   * Mark this procedure as an ORDS endpoint. All settings are optional —
   * the module is derived from the package name, the HTTP method from the
   * procedure name prefix (GET_/POST_/PUT_/DELETE_), and parameter types
   * are mapped automatically from PL/SQL types.
   *
   * @example
   * proc.ords()                          // fully automatic
   * proc.ords(e => e.comment('...'))     // with overrides
   */
  ords(build?: (e: OrdsEndpointBuilder) => void): this {
    this._ordsBuilder = new OrdsEndpointBuilder()
    build?.(this._ordsBuilder)
    return this
  }

  /**
   * Expose this procedure as an ORDS service using an explicit, reviewable
   * public contract. Prefer this over `ords()` for application endpoints.
   *
   * @example
   * proc.service({
   *   method: 'GET',
   *   path: '/users/:id',
   *   summary: 'Fetch a single user',
   * })
   */
  service(definition: OrdsServiceDefinition): this {
    const endpoint = new OrdsEndpointBuilder()
      .method(definition.method)
      .pattern(normalizeServicePath(definition.path))

    if (definition.summary) endpoint.comment(definition.summary)
    if (definition.module) endpoint.module(definition.module)
    if (definition.basePath) endpoint.basePath(normalizeBasePath(definition.basePath))

    for (const [param, type] of Object.entries(definition.paramTypes ?? {})) {
      endpoint.paramType(param, type)
    }

    this._ordsBuilder = endpoint
    return this
  }

  /** @internal Called by Package.toOrdsSQL() */
  buildOrdsEndpoint(packageName: string): OrdsEndpoint | undefined {
    return this._ordsBuilder?.build(packageName, this.name, this._params)
  }

  toNode(): ProcedureNode {
    return {
      kind: 'procedure',
      name: this.name,
      params: this._params.map((p) => p.toNode()),
      body: this._body?.toNode(),
    }
  }

  toObject() {
    return this.toNode()
  }
}

// ── Function ──────────────────────────────────────────────────────────────────

export class PlsqlFunction {
  private _params: Param[] = []
  private _body?: ProcedureBody
  private _returnTypeOptions: { length?: number } = {}

  constructor(
    readonly name: string,
    readonly returnType: PlsqlType | string,
  ) {}

  /** Set the length qualifier on the return type (e.g. for VARCHAR2). */
  returnLength(n: number): this {
    this._returnTypeOptions.length = n
    return this
  }

  /** Add a parameter (default direction IN). */
  param(name: string, type: PlsqlType | string, direction: ParameterDirection = 'IN'): Param {
    const p = new Param(name, type, direction)
    this._params.push(p)
    return p
  }

  /** Shorthand: add an IN parameter. */
  in(name: string, type: PlsqlType | string): Param {
    return this.param(name, type, 'IN')
  }

  /** Shorthand: add an OUT parameter. */
  out(name: string, type: PlsqlType | string): Param {
    return this.param(name, type, 'OUT')
  }

  /** Shorthand: add an IN OUT parameter. */
  inOut(name: string, type: PlsqlType | string): Param {
    return this.param(name, type, 'IN OUT')
  }

  /**
   * Define the function body (local variables + executable statements).
   * If omitted the body will emit `RETURN NULL;`.
   */
  body(build: (body: ProcedureBody) => void): this {
    this._body = new ProcedureBody()
    build(this._body)
    return this
  }

  toNode(): FunctionNode {
    return {
      kind: 'function',
      name: this.name,
      params: this._params.map((p) => p.toNode()),
      returnType: this.returnType,
      returnTypeOptions: { ...this._returnTypeOptions },
      body: this._body?.toNode(),
    }
  }

  toObject() {
    return this.toNode()
  }
}

// ── Package ───────────────────────────────────────────────────────────────────

export class Package {
  private _procedures: Procedure[] = []
  private _functions: PlsqlFunction[] = []

  constructor(readonly name: string) {}

  procedure(name: string, build?: (proc: Procedure) => void): Procedure {
    const p = new Procedure(name)
    build?.(p)
    this._procedures.push(p)
    return p
  }

  func(
    name: string,
    returnType: PlsqlType | string,
    build?: (fn: PlsqlFunction) => void,
  ): PlsqlFunction {
    const f = new PlsqlFunction(name, returnType)
    build?.(f)
    this._functions.push(f)
    return f
  }

  toNode(): PackageNode {
    return {
      kind: 'package',
      name: this.name,
      procedures: this._procedures.map((p) => p.toNode()),
      functions: this._functions.map((f) => f.toNode()),
    }
  }

  toObject() {
    return this.toNode()
  }

  toSQLUp(options: PackageSqlOptions = {}): string {
    const node = this.toNode()
    return [emitPackageSpec(node, options), '/', emitPackageBody(node, options), '/'].join('\n')
  }

  /** Generate ORDS registration SQL for all configured procedure services. */
  toOrdsSQL(options: { schema?: string } = {}): string {
    return this._procedures
      .map((p) => p.buildOrdsEndpoint(this.name))
      .filter((e): e is OrdsEndpoint => e !== undefined)
      .map((e) => e.toSQLUp(options))
      .join('\n\n')
  }

  /** Drop ORDS modules for all configured procedure services. */
  toOrdsDownSQL(options: { schema?: string } = {}): string {
    const endpoints = this._procedures
      .map((p) => p.buildOrdsEndpoint(this.name))
      .filter((e): e is OrdsEndpoint => e !== undefined)
    const seenModules = new Set<string>()
    return endpoints
      .filter((e) => {
        if (seenModules.has(e.module)) return false
        seenModules.add(e.module)
        return true
      })
      .map((e) => e.toSQLDown(options))
      .join('\n\n')
  }

  toSQLDown(options: PackageSqlOptions = {}): string {
    return `DROP PACKAGE ${qualifyName(this.name, options.schema)};`
  }
}

// ── SQL emission ──────────────────────────────────────────────────────────────

function qualifyName(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

function emitPackageSpec(pkg: PackageNode, options: PackageSqlOptions = {}): string {
  const name = qualifyName(pkg.name, options.schema)
  const orReplace = options.orReplace !== false ? 'OR REPLACE ' : ''
  const lines: string[] = [`CREATE ${orReplace}PACKAGE ${name} AS`]

  for (const proc of pkg.procedures) {
    const params = proc.params.map(emitParamDef).join(', ')
    lines.push(`  PROCEDURE ${proc.name}(${params});`)
  }

  for (const fn of pkg.functions) {
    const params = fn.params.map(emitParamDef).join(', ')
    const ret = emitParamType(fn.returnType)
    lines.push(`  FUNCTION ${fn.name}(${params}) RETURN ${ret};`)
  }

  lines.push(`END ${pkg.name};`)
  return lines.join('\n')
}

function emitPackageBody(pkg: PackageNode, options: PackageSqlOptions = {}): string {
  const name = qualifyName(pkg.name, options.schema)
  const orReplace = options.orReplace !== false ? 'OR REPLACE ' : ''
  const lines: string[] = [`CREATE ${orReplace}PACKAGE BODY ${name} AS`]

  for (const proc of pkg.procedures) {
    lines.push(emitProcedureImpl(proc))
  }

  for (const fn of pkg.functions) {
    lines.push(emitFunctionImpl(fn))
  }

  lines.push(`END ${pkg.name};`)
  return lines.join('\n')
}

function emitProcedureImpl(proc: ProcedureNode): string {
  const params = proc.params.map(emitParamDef).join(', ')
  const sig = `  PROCEDURE ${proc.name}(${params}) IS`

  if (!proc.body) {
    return [sig, '  BEGIN', '    NULL;', `  END ${proc.name};`].join('\n')
  }

  const lines: string[] = [sig]

  for (const decl of proc.body.declarations) {
    lines.push(`    ${emitLocalVarDecl(decl)}`)
  }

  lines.push('  BEGIN')

  if (proc.body.statements.length === 0) {
    lines.push('    NULL;')
  } else {
    for (const stmt of proc.body.statements) {
      lines.push(`    ${emitStatement(stmt)}`)
    }
  }

  lines.push(`  END ${proc.name};`)
  return lines.join('\n')
}

function emitFunctionImpl(fn: FunctionNode): string {
  const params = fn.params.map(emitParamDef).join(', ')
  const ret = emitParamType(fn.returnType)
  const sig = `  FUNCTION ${fn.name}(${params}) RETURN ${ret} IS`

  if (!fn.body) {
    return [sig, '  BEGIN', '    RETURN NULL;', `  END ${fn.name};`].join('\n')
  }

  const lines: string[] = [sig]

  for (const decl of fn.body.declarations) {
    lines.push(`    ${emitLocalVarDecl(decl)}`)
  }

  lines.push('  BEGIN')

  if (fn.body.statements.length === 0) {
    lines.push('    RETURN NULL;')
  } else {
    for (const stmt of fn.body.statements) {
      lines.push(`    ${emitStatement(stmt)}`)
    }
  }

  lines.push(`  END ${fn.name};`)
  return lines.join('\n')
}

function emitStatement(stmt: StatementNode): string {
  switch (stmt.kind) {
    case 'assign':
      return `${stmt.target} := ${stmt.value};`
    case 'return':
      return stmt.value !== undefined ? `RETURN ${stmt.value};` : 'RETURN;'
    case 'null':
      return 'NULL;'
    case 'raw':
      return stmt.sql.trimEnd().endsWith(';') ? stmt.sql : `${stmt.sql};`
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function odbPackage(name: string, build?: (pkg: Package) => void): Package {
  const pkg = new Package(name)
  build?.(pkg)
  return pkg
}

export function odbProcedure(name: string, build?: (proc: Procedure) => void): Procedure {
  const p = new Procedure(name)
  build?.(p)
  return p
}

export function odbFunction(
  name: string,
  returnType: PlsqlType | string,
  build?: (fn: PlsqlFunction) => void,
): PlsqlFunction {
  const f = new PlsqlFunction(name, returnType)
  build?.(f)
  return f
}
