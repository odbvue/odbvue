import {
  BlobVar,
  ClobVar,
  LocalVar,
  Param,
  PlsqlExpression,
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
import {
  OrdsEndpoint,
  type OrdsHttpMethod,
  type OrdsParamType,
  type OrdsResultColumnNode,
} from '../ords.js'
import { ordsTypeFromPlsql } from '../model.js'
import { Column, type ColumnNode } from './column.js'
import { odbQuery } from '../query/index.js'
import type { Insertable, Table } from './table.js'

// ── Query builder integration ─────────────────────────────────────────────────

/** Any query builder that can emit SQL and optionally expose a typed selected row. */
export type AnyQueryBuilder = {
  toSQL(): string
  selectedColumns?(): ColumnNode[] | undefined
}

type ParameterTypeAlias = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'clob'
type ParameterInput = PlsqlType | string | Column<any, string, any, any, any, any, any>

type ResolvedParameterType<TInput extends ParameterInput> =
  TInput extends Column<any, any, any, any, any, any, any>
    ? string
    : TInput extends 'string'
      ? 'VARCHAR2'
      : TInput extends 'number'
        ? 'NUMBER'
        : TInput extends 'boolean'
          ? 'BOOLEAN'
          : TInput extends 'date'
            ? 'DATE'
            : TInput extends 'timestamp'
              ? 'TIMESTAMP'
              : TInput extends 'clob'
                ? 'CLOB'
                : TInput

type InputParameters<TInputs extends Record<string, ParameterInput>> = {
  [TKey in keyof TInputs]: Param<ResolvedParameterType<TInputs[TKey]>>
}

const parameterTypeAliases: Record<ParameterTypeAlias, PlsqlType> = {
  string: 'VARCHAR2',
  number: 'NUMBER',
  boolean: 'BOOLEAN',
  date: 'DATE',
  timestamp: 'TIMESTAMP',
  clob: 'CLOB',
}

function inputParameterName(key: string): string {
  const snakeCase = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  return `p_${snakeCase}`
}

function inputParameterType(input: ParameterInput): PlsqlType | string {
  if (input instanceof Column) return input.typeReference()
  return parameterTypeAliases[input as ParameterTypeAlias] ?? input
}

// ── Statement types ──────────────────────────────────────────────────────────

export type IfBranchNode = { condition: string; statements: StatementNode[] }

export type StatementNode =
  | { kind: 'assign'; target: string; value: string }
  | { kind: 'return'; value?: string }
  | { kind: 'null' }
  | { kind: 'raw'; sql: string }
  | { kind: 'if'; branches: IfBranchNode[]; elseStatements?: StatementNode[] }

export type ExceptionHandlerNode = { when: string; statements: StatementNode[] }

// ── AST node types ───────────────────────────────────────────────────────────

export type ProcedureBodyNode = {
  declarations: LocalVarNode[]
  statements: StatementNode[]
  resultSets?: Record<string, OrdsResultColumnNode[]>
  exceptionHandlers?: ExceptionHandlerNode[]
}

export type ServiceNode = {
  method?: OrdsHttpMethod
  path?: string
  summary?: string
  module?: string
  basePath?: string
  paramTypes?: Record<string, OrdsParamType>
}

export type ProcedureNode = {
  kind: 'procedure'
  name: string
  params: ParamNode[]
  body?: ProcedureBodyNode
  service?: ServiceNode
}

export type FunctionNode = {
  kind: 'function'
  name: string
  params: ParamNode[]
  returnType: PlsqlType | string
  returnTypeOptions: { length?: number }
  body?: ProcedureBodyNode
}

export type OdbApplication = {
  kind: 'package'
  name: string
  procedures: ProcedureNode[]
  functions: FunctionNode[]
}

export type ApplicationLike = OdbApplication | { application(): OdbApplication }

export function applicationNode(application: ApplicationLike): OdbApplication {
  return 'application' in application ? application.application() : application
}

export type PackageSqlOptions = {
  schema?: string
  orReplace?: boolean
  /**
   * Physical object name to emit instead of the public name. Used by the
   * blue/green deployment flow to create the package under a colored name
   * (e.g. `PCK_APP_BLUE`) behind a stable synonym.
   */
  physicalName?: string
}

type PackageMemberDefinition = PlsqlFunction<any> | Procedure

type PackageMemberReturnValue<TMember extends PackageMemberDefinition> =
  TMember extends PlsqlFunction<infer TReturnType> ? PlsqlExpression<TReturnType> : void

type PackageMemberInvoker<TMember extends PackageMemberDefinition> = (
  ...args: PlsqlRenderable[]
) => PackageMemberReturnValue<TMember>

type PackageShape<TMembers extends Record<string, PackageMemberDefinition>> = {
  [TKey in keyof TMembers]: PackageMemberInvoker<TMembers[TKey]>
}

// ── ProcedureBody ─────────────────────────────────────────────────────────────

export class ProcedureBody {
  private _declarations: LocalVar[] = []
  private _statements: StatementNode[] = []
  private _returnCounter = 0
  private _cursorResultColumns = new Map<string, OrdsResultColumnNode[]>()
  private _exceptionHandlers: ExceptionHandlerNode[] = []

  /**
   * @param _returnType   Return type of the enclosing function, if any. Enables
   *                      `returnQuery()` to declare a correctly typed result var.
   * @param _returnLength Optional length qualifier for the return type.
   */
  constructor(
    private readonly _returnType?: PlsqlType | string,
    private readonly _returnLength?: number,
  ) {}

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
  return(value?: PlsqlRenderable): this {
    this._statements.push({
      kind: 'return',
      value: value === undefined ? undefined : renderPlsql(value),
    })
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
   * Emit an `odb_audit` log statement. `message` is a plain text body (quoted
   * automatically); `attributes` is a JSON object whose keys are OTel attribute
   * names and whose values are PL/SQL expressions (bare variable, literal, or
   * nested call). Requires the `odb_audit` framework package to be installed.
   *
   * Duplicates the `odb_audit.*` call strings here (rather than importing from
   * `packages/framework/audit`) to keep the schema layer free of a
   * schema→packages import cycle.
   */
  private audit(
    severity: string,
    message: string,
    attributes?: Record<string, PlsqlRenderable>,
  ): this {
    const body = `'${message.replace(/'/g, "''")}'`
    const args = attributes ? `${body}, ${renderAuditAttributes(attributes)}` : body
    return this.raw(`odb_audit.${severity}(${args})`)
  }

  /** `odb_audit.debug(<message>[, <attributes>])` */
  auditDebug(message: string, attributes?: Record<string, PlsqlRenderable>): this {
    return this.audit('debug', message, attributes)
  }

  /** `odb_audit.info(<message>[, <attributes>])` */
  auditInfo(message: string, attributes?: Record<string, PlsqlRenderable>): this {
    return this.audit('info', message, attributes)
  }

  /** `odb_audit.warn(<message>[, <attributes>])` */
  auditWarn(message: string, attributes?: Record<string, PlsqlRenderable>): this {
    return this.audit('warn', message, attributes)
  }

  /** `odb_audit.error(<message>[, <attributes>])` */
  auditError(message: string, attributes?: Record<string, PlsqlRenderable>): this {
    return this.audit('error', message, attributes)
  }

  /** `odb_audit.fatal(<message>[, <attributes>])` */
  auditFatal(message: string, attributes?: Record<string, PlsqlRenderable>): this {
    return this.audit('fatal', message, attributes)
  }

  /** Record an audit event at INFO severity (alias of `auditInfo`). */
  auditEvent(message: string, attributes?: Record<string, PlsqlRenderable>): this {
    return this.audit('info', message, attributes)
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

  /** Emit a typed `INSERT INTO ... VALUES ...` statement. */
  insertInto<TTable extends Table<any>>(table: TTable, values: Insertable<TTable>): this {
    return this.query(odbQuery().insertInto(table).values(values))
  }

  /**
   * Emit `SELECT ... INTO <target> ...;` for a target reference (OUT param or
   * local variable), wiring the query's INTO clause automatically.
   *
   * @example
   * body.selectInto(pVersion, odbQuery().selectFrom('dual').select('...'))
   */
  selectInto(
    target: PlsqlReference,
    qb: AnyQueryBuilder & { into(target: string): unknown },
  ): this {
    qb.into(target.name)
    return this.query(qb)
  }

  /**
   * Emit `SELECT ... INTO <result>;` followed by `RETURN <result>;` for a
   * function that returns a single queried value. A result variable typed to
   * the function's return type is declared automatically — no intermediate
   * local needed in the caller. Only valid inside a function body.
   *
   * @example
   * fn.body((body) =>
   *   body.returnQuery(odbQuery().selectFrom(usersTable).select('name').where('id', '=', pId)))
   */
  returnQuery(qb: AnyQueryBuilder & { into(target: string): unknown }): this {
    if (this._returnType === undefined) {
      throw new Error('returnQuery() can only be used inside a function body')
    }
    const name = this._returnCounter === 0 ? 'l_return' : `l_return${this._returnCounter}`
    this._returnCounter++
    const result = this.variable(name, this._returnType, this._returnLength)
    qb.into(name)
    this.query(qb)
    return this.return(result)
  }

  /**
   * Emit `OPEN <cursor> FOR <select query>;`
   *
   * @example
   * body.openFor('p_cursor', select('employees').columns(['id', 'name']))
   */
  openFor(cursor: string | PlsqlReference, qb: AnyQueryBuilder): this {
    const cursorName = typeof cursor === 'string' ? cursor : cursor.name
    const columns = qb.selectedColumns?.()
    if (columns) {
      this._cursorResultColumns.set(
        cursorName.toUpperCase(),
        columns.map((column) => ({
          name: column.name,
          type: column.type,
          nullable: column.options.nullable !== false,
        })),
      )
    }
    this._statements.push({ kind: 'raw', sql: `OPEN ${cursorName} FOR ${qb.toSQL()}` })
    return this
  }

  /**
   * Collect the statements produced by a nested block builder (an IF branch or
   * an EXCEPTION handler). PL/SQL has no nested DECLARE section here, so any
   * locals and typed cursor metadata declared inside are hoisted to this body.
   */
  private childStatements(build: (body: ProcedureBody) => void): StatementNode[] {
    const child = new ProcedureBody(this._returnType, this._returnLength)
    build(child)
    for (const declaration of child._declarations) {
      this._declarations.push(declaration)
    }
    for (const [name, columns] of child._cursorResultColumns) {
      this._cursorResultColumns.set(name, columns)
    }
    return child._statements
  }

  /**
   * Emit `IF <condition> THEN <then> [ELSE <else>] END IF;`. The branch builders
   * receive a nested body; locals declared inside are hoisted to the enclosing
   * procedure/function.
   *
   * @example
   * body.ifThen(
   *   'v_status = 200',
   *   (t) => t.assign(rToken, issueToken),
   *   (e) => e.auditWarn('login failed'),
   * )
   */
  ifThen(
    condition: PlsqlRenderable,
    buildThen: (body: ProcedureBody) => void,
    buildElse?: (body: ProcedureBody) => void,
  ): this {
    const node: StatementNode = {
      kind: 'if',
      branches: [
        { condition: renderPlsql(condition), statements: this.childStatements(buildThen) },
      ],
    }
    if (buildElse) {
      node.elseStatements = this.childStatements(buildElse)
    }
    this._statements.push(node)
    return this
  }

  /**
   * Add an `EXCEPTION` handler for a named exception. Handlers are emitted after
   * the body statements, in the order they are declared.
   *
   * @example
   * body.when('no_data_found', (h) => h.assign(rError, odbLiteral('not found')))
   */
  when(exceptionName: string, build: (body: ProcedureBody) => void): this {
    this._exceptionHandlers.push({ when: exceptionName, statements: this.childStatements(build) })
    return this
  }

  /** Add a `WHEN OTHERS THEN ...` exception handler. */
  whenOthers(build: (body: ProcedureBody) => void): this {
    return this.when('OTHERS', build)
  }

  /** @internal Row metadata retained for a typed SYS_REFCURSOR query. */
  cursorResultColumns(cursor: string): OrdsResultColumnNode[] | undefined {
    return this._cursorResultColumns.get(cursor.toUpperCase())
  }

  toNode(): ProcedureBodyNode {
    return {
      declarations: this._declarations.map((v) => v.toNode()),
      statements: [...this._statements],
      resultSets:
        this._cursorResultColumns.size > 0
          ? Object.fromEntries(
              [...this._cursorResultColumns].map(([name, columns]) => [
                name,
                columns.map((column) => ({ ...column })),
              ]),
            )
          : undefined,
      exceptionHandlers:
        this._exceptionHandlers.length > 0
          ? this._exceptionHandlers.map((handler) => ({
              when: handler.when,
              statements: [...handler.statements],
            }))
          : undefined,
    }
  }
}

// ── Procedure ─────────────────────────────────────────────────────────────────

/** Build an `odb_audit.attributes(...)` CLOB from an attributes map. */
function renderAuditAttributes(attributes: Record<string, PlsqlRenderable>): string {
  const entries = Object.entries(attributes)
  if (entries.length === 0) return `TO_CLOB('{}')`
  if (entries.length > 6) {
    throw new Error('Audit attributes support at most 6 entries')
  }
  const args = entries.flatMap(([key, value]) => [
    `'${key.replace(/'/g, "''")}'`,
    renderPlsql(value),
  ])
  return `odb_audit.attributes(${args.join(', ')})`
}

/**
 * Maps a PL/SQL type to the nearest ORDS parameter type.
 * https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/18.3/aelig/ords-database-type-mappings.html
 */
function plsqlToOrdsType(type: PlsqlType | string): OrdsParamType {
  return ordsTypeFromPlsql(type)
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

/** Compile a procedure's service metadata into an ORDS endpoint. */
function buildOrdsEndpoint(
  packageName: string,
  procedure: ProcedureNode,
): OrdsEndpoint | undefined {
  const service = procedure.service
  if (!service) return undefined

  const module = service.module ?? deriveOrdsModule(packageName)
  const endpoint = new OrdsEndpoint(module, packageName, procedure.name)
  if (service.basePath !== undefined) endpoint.basePath(service.basePath)
  if (service.method) endpoint.method(service.method)
  if (service.path !== undefined) endpoint.pattern(service.path)
  if (service.summary) endpoint.comment(service.summary)

  const typeOverrides = new Map(
    Object.entries(service.paramTypes ?? {}).map(([name, type]) => [name.toUpperCase(), type]),
  )
  for (const param of procedure.params) {
    const ordsType = typeOverrides.get(param.name.toUpperCase()) ?? plsqlToOrdsType(param.type)
    endpoint.param(
      param.name,
      param.direction,
      ordsType,
      undefined,
      ordsType === 'RESULTSET'
        ? procedure.body?.resultSets?.[param.name.toUpperCase()]?.map((column) => ({ ...column }))
        : undefined,
    )
  }

  return endpoint
}

/** @internal Derive ORDS endpoints from the canonical application contract. */
export function compileApplicationEndpoints(application: ApplicationLike): OrdsEndpoint[] {
  const node = applicationNode(application)
  return node.procedures
    .map((procedure) => buildOrdsEndpoint(node.name, procedure))
    .filter((endpoint): endpoint is OrdsEndpoint => endpoint !== undefined)
}

// ── Procedure ─────────────────────────────────────────────────────────────────

export class Procedure {
  private _params: Param[] = []
  private _body?: ProcedureBody
  private _service?: ServiceNode

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

  /** Add named IN parameters using automatic `p_` names and optional column `%TYPE` anchors. */
  inputs<TInputs extends Record<string, ParameterInput>>(
    definitions: TInputs,
  ): InputParameters<TInputs> {
    const parameters = {} as InputParameters<TInputs>
    for (const [key, input] of Object.entries(definitions)) {
      parameters[key as keyof TInputs] = this.in(
        inputParameterName(key),
        inputParameterType(input),
      ) as InputParameters<TInputs>[keyof TInputs]
    }
    return parameters
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
   * Expose this procedure as an ORDS service using an explicit, reviewable
   * public contract.
   *
   * @example
   * proc.service({
   *   method: 'GET',
   *   path: '/users/:id',
   *   summary: 'Fetch a single user',
   * })
   */
  service(definition: OrdsServiceDefinition): this {
    this._service = {
      ...definition,
      path: normalizeServicePath(definition.path),
      basePath: definition.basePath ? normalizeBasePath(definition.basePath) : undefined,
      paramTypes: definition.paramTypes ? { ...definition.paramTypes } : undefined,
    }
    return this
  }

  toNode(): ProcedureNode {
    return {
      kind: 'procedure',
      name: this.name,
      params: this._params.map((p) => p.toNode()),
      body: this._body?.toNode(),
      service: this._service
        ? {
            ...this._service,
            paramTypes: this._service.paramTypes ? { ...this._service.paramTypes } : undefined,
          }
        : undefined,
    }
  }
}

// ── Function ──────────────────────────────────────────────────────────────────

export class PlsqlFunction<TReturnType extends PlsqlType | string = PlsqlType | string> {
  private _params: Param[] = []
  private _body?: ProcedureBody
  private _returnTypeOptions: { length?: number } = {}

  constructor(
    readonly name: string,
    readonly returnType: TReturnType,
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
    this._body = new ProcedureBody(this.returnType, this._returnTypeOptions.length)
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
}

// ── Package ───────────────────────────────────────────────────────────────────

export type Package<
  TMembers extends Record<string, PackageMemberDefinition> = Record<string, never>,
> = PackageShape<TMembers> & {
  readonly name: string
  readonly objectName: string
  readonly isBlueGreen: true
  proc(name: string, build?: (proc: Procedure) => void): Procedure
  func<TReturnType extends PlsqlType | string = PlsqlType | string>(
    name: string,
    returnType: TReturnType,
    build?: (fn: PlsqlFunction<TReturnType>) => void,
  ): PlsqlFunction<TReturnType>
  call<TMemberName extends keyof TMembers>(
    member: TMemberName,
    ...args: PlsqlRenderable[]
  ): PackageMemberReturnValue<TMembers[TMemberName]>
  application(): OdbApplication
  toSQLUp(options?: PackageSqlOptions): string
  toSQLDown(options?: PackageSqlOptions): string
}

export class PackageImpl<
  TMembers extends Record<string, PackageMemberDefinition> = Record<string, never>,
> {
  private _procedures: Procedure[] = []
  private _functions: PlsqlFunction<any>[] = []
  private _memberLookup: Record<string, PackageMemberDefinition> = {}

  /**
   * Marks this artifact for blue/green deployment. The migration layer creates
   * the package under a colored physical name and repoints a stable synonym,
   * so live callers (ORDS handlers, jobs) are never blocked by a recompile.
   */
  readonly isBlueGreen = true as const

  constructor(readonly name: string) {}

  /** Public (synonym) name callers use — the stable identity across colors. */
  get objectName(): string {
    return this.name
  }

  private registerInvoker(alias: string, member: PackageMemberDefinition): void {
    this._memberLookup[alias] = member
    this._memberLookup[alias.toUpperCase()] = member
    Object.defineProperty(this, alias, {
      value: (...args: PlsqlRenderable[]) => this.invoke(alias, ...args),
      configurable: true,
      enumerable: true,
      writable: false,
    })
  }

  private invoke(
    alias: string,
    ...args: PlsqlRenderable[]
  ): PackageMemberReturnValue<PackageMemberDefinition> {
    const member = this._memberLookup[alias] ?? this._memberLookup[alias.toUpperCase()]
    if (!member) {
      throw new Error(`Unknown package member: ${alias}`)
    }

    if (!(member instanceof PlsqlFunction)) {
      throw new Error(`Package member ${alias} is not a function`)
    }

    const rendered = args.map(renderPlsql).join(', ')
    return new PlsqlExpression(
      member.returnType,
      `${this.name}.${member.name}(${rendered})`,
    ) as PackageMemberReturnValue<PackageMemberDefinition>
  }

  proc(name: string, build?: (proc: Procedure) => void): Procedure {
    const p = new Procedure(name)
    build?.(p)
    this._procedures.push(p)
    return p
  }

  func<TReturnType extends PlsqlType | string = PlsqlType | string>(
    name: string,
    returnType: TReturnType,
    build?: (fn: PlsqlFunction<TReturnType>) => void,
  ): PlsqlFunction<TReturnType> {
    const f = new PlsqlFunction(name, returnType)
    build?.(f)
    this._functions.push(f)
    return f
  }

  /**
   * Build a typed call expression to a member of this package, e.g.
   * `pck_api_settings.get_value('APP_VERSION')`. The return type is inferred
   * from the declared function (defaults to VARCHAR2). Callers reference the
   * package by name and rely on definer rights for schema resolution.
   *
   * @example
   * body.selectInto(pVersion,
   *   odbQuery().selectFrom('dual').select(settings.call('get_value', odbLiteral('APP_VERSION'))))
   */
  call<TMemberName extends keyof TMembers>(
    member: TMemberName,
    ...args: PlsqlRenderable[]
  ): PackageMemberReturnValue<TMembers[TMemberName]> {
    return this.invoke(member as string, ...args) as PackageMemberReturnValue<TMembers[TMemberName]>
  }

  application(): OdbApplication {
    return {
      kind: 'package',
      name: this.name,
      procedures: this._procedures.map((p) => p.toNode()),
      functions: this._functions.map((f) => f.toNode()),
    }
  }

  toSQLUp(options: PackageSqlOptions = {}): string {
    return emitApplicationSql(this, options)
  }

  toSQLDown(options: PackageSqlOptions = {}): string {
    const name = qualifyName(options.physicalName ?? this.name, options.schema)
    return [
      `BEGIN`,
      `  EXECUTE IMMEDIATE 'DROP PACKAGE ${name}';`,
      `EXCEPTION WHEN OTHERS THEN`,
      `  IF SQLCODE != -4043 THEN RAISE; END IF;`,
      `END;`,
      `/`,
    ].join('\n')
  }
}

/** Emit package specification and body SQL from a plain application contract. */
export function emitApplicationSql(
  application: ApplicationLike,
  options: PackageSqlOptions = {},
): string {
  const node = applicationNode(application)
  return [emitPackageSpec(node, options), '/', emitPackageBody(node, options), '/'].join('\n')
}

// ── SQL emission ──────────────────────────────────────────────────────────────

function qualifyName(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

function emitPackageSpec(pkg: OdbApplication, options: PackageSqlOptions = {}): string {
  const identifier = options.physicalName ?? pkg.name
  const name = qualifyName(identifier, options.schema)
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

  lines.push(`END ${identifier};`)
  return lines.join('\n')
}

function emitPackageBody(pkg: OdbApplication, options: PackageSqlOptions = {}): string {
  const identifier = options.physicalName ?? pkg.name
  const name = qualifyName(identifier, options.schema)
  const orReplace = options.orReplace !== false ? 'OR REPLACE ' : ''
  const lines: string[] = [`CREATE ${orReplace}PACKAGE BODY ${name} AS`]

  for (const proc of pkg.procedures) {
    lines.push(emitProcedureImpl(proc))
  }

  for (const fn of pkg.functions) {
    lines.push(emitFunctionImpl(fn))
  }

  lines.push(`END ${identifier};`)
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
  lines.push(...emitStatementBlock(proc.body.statements, '    '))
  emitExceptionSection(lines, proc.body.exceptionHandlers, '  ')
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
    lines.push(...emitStatementBlock(fn.body.statements, '    '))
  }

  emitExceptionSection(lines, fn.body.exceptionHandlers, '  ')
  lines.push(`  END ${fn.name};`)
  return lines.join('\n')
}

/** Emit a block of statements at the given indent, or `NULL;` when empty. */
function emitStatementBlock(statements: StatementNode[], indent: string): string[] {
  if (statements.length === 0) return [`${indent}NULL;`]
  return statements.flatMap((stmt) => emitStatement(stmt, indent))
}

/** Append an `EXCEPTION` section when the body declares any handlers. */
function emitExceptionSection(
  lines: string[],
  handlers: ExceptionHandlerNode[] | undefined,
  indent: string,
): void {
  if (!handlers || handlers.length === 0) return
  lines.push(`${indent}EXCEPTION`)
  for (const handler of handlers) {
    lines.push(`${indent}  WHEN ${handler.when} THEN`)
    lines.push(...emitStatementBlock(handler.statements, `${indent}    `))
  }
}

function emitStatement(stmt: StatementNode, indent: string): string[] {
  switch (stmt.kind) {
    case 'assign':
      return [`${indent}${stmt.target} := ${stmt.value};`]
    case 'return':
      return [stmt.value !== undefined ? `${indent}RETURN ${stmt.value};` : `${indent}RETURN;`]
    case 'null':
      return [`${indent}NULL;`]
    case 'raw':
      return [`${indent}${stmt.sql.trimEnd().endsWith(';') ? stmt.sql : `${stmt.sql};`}`]
    case 'if': {
      const lines: string[] = []
      stmt.branches.forEach((branch, index) => {
        lines.push(`${indent}${index === 0 ? 'IF' : 'ELSIF'} ${branch.condition} THEN`)
        lines.push(...emitStatementBlock(branch.statements, `${indent}  `))
      })
      if (stmt.elseStatements) {
        lines.push(`${indent}ELSE`)
        lines.push(...emitStatementBlock(stmt.elseStatements, `${indent}  `))
      }
      lines.push(`${indent}END IF;`)
      return lines
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function odbPackage<TMembers extends Record<string, PackageMemberDefinition>>(
  name: string,
  build?: (pkg: PackageImpl<any>) => TMembers | void,
): Package<TMembers> {
  const pkg = new PackageImpl<TMembers>(name)
  const result = build?.(pkg)

  if (result && typeof result === 'object') {
    for (const [key, member] of Object.entries(result)) {
      pkg['registerInvoker'](key, member as PackageMemberDefinition)
    }
  }

  return pkg as unknown as Package<TMembers>
}
