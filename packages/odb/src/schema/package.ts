import {
  BlobVar,
  ClobVar,
  type PlsqlBooleanExpression,
  LocalVar,
  Param,
  PlsqlExpression,
  Varchar2Var,
  type LocalVarNode,
  type ParamNode,
  type PlsqlReference,
  type PlsqlRenderable,
  type PlsqlType,
  type PlsqlValue,
  PlsqlStatement,
  emitLocalVarDecl,
  emitParamDef,
  emitParamType,
  emitPlsqlType,
  renderPlsql,
} from './attribute.js'
import {
  OrdsEndpoint,
  type OrdsHttpMethod,
  type OrdsParamType,
  type OrdsResultColumnNode,
} from '../ords.js'
import { odbTypeFromPlsql, oracleParameterName, ordsTypeFromPlsql, type OdbType } from '../model.js'
import { Column, type ColumnNode } from './column.js'
import { odbQuery } from '../query/index.js'
import type { Insertable, Table } from './table.js'

// ── Query builder integration ─────────────────────────────────────────────────

/** Any query builder that can emit SQL and optionally expose a typed selected row. */
export type AnyQueryBuilder = {
  toSQL(): string
  selectedColumns?(): ColumnNode[] | undefined
}

export type OdbTypeDescriptor<TType extends PlsqlType | string> = {
  type: TType
  length?: number
}

type ParameterInput =
  | Column<any, string, any, any, any, any, any>
  | OdbTypeDescriptor<PlsqlType | string>

type ResolvedParameterType<TInput extends ParameterInput> =
  TInput extends OdbTypeDescriptor<infer TType>
    ? TType
    : TInput extends Column<any, any, any, any, any, any, any>
      ? string
      : never

type InputParameters<TInputs extends Record<string, ParameterInput>> = {
  [TKey in keyof TInputs]: Param<ResolvedParameterType<TInputs[TKey]>>
}

export type LocalVariableDefinition<TType extends PlsqlType | string> = OdbTypeDescriptor<TType>

type LocalVariableInput = ParameterInput

type ResolvedLocalVariableType<TInput extends LocalVariableInput> =
  TInput extends LocalVariableDefinition<infer TType>
    ? TType
    : TInput extends ParameterInput
      ? ResolvedParameterType<TInput>
      : never

type LocalVariableForType<TType extends PlsqlType | string> = TType extends 'CLOB'
  ? ClobVar
  : TType extends 'BLOB'
    ? BlobVar
    : TType extends 'VARCHAR2'
      ? Varchar2Var
      : LocalVar<TType>

type LocalVariables<TInputs extends Record<string, LocalVariableInput>> = {
  [TKey in keyof TInputs]: LocalVariableForType<ResolvedLocalVariableType<TInputs[TKey]>>
}

type PlsqlLiteral<TType extends PlsqlType | string> =
  | null
  | (TType extends 'VARCHAR2' | 'CLOB'
      ? string
      : TType extends 'NUMBER' | 'PLS_INTEGER' | 'INTEGER' | 'BINARY_INTEGER'
        ? number
        : TType extends 'BOOLEAN'
          ? boolean
          : never)

export type ProcedureParameters = {
  in?: Record<string, ParameterInput>
  out?: Record<string, ParameterInput>
  inOut?: Record<string, ParameterInput>
}

export type FunctionParameters = {
  in: Record<string, ParameterInput>
}

type ParameterGroup<TParameters, TDirection extends keyof ProcedureParameters> =
  TParameters extends Record<TDirection, infer TInputs>
    ? TInputs extends Record<string, ParameterInput>
      ? InputParameters<TInputs>
      : {}
    : {}

type NamedParameters<TParameters extends ProcedureParameters> = ParameterGroup<TParameters, 'in'> &
  ParameterGroup<TParameters, 'out'> &
  ParameterGroup<TParameters, 'inOut'>

function inputParameterName(key: string): string {
  const snakeCase = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  return `p_${snakeCase}`
}

function localVariableName(key: string): string {
  const snakeCase = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  return `l_${snakeCase}`
}

function isPlsqlValue(value: unknown): value is { toSQL(): string } {
  return typeof value === 'object' && value !== null && 'toSQL' in value
}

function renderPlsqlLiteral(value: string | number | boolean | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (!Number.isFinite(value)) throw new Error('set: number literals must be finite.')
  return String(value)
}

function inputParameterType(input: ParameterInput): PlsqlType | string {
  if (input instanceof Column) return input.typeReference()
  return input.type
}

function inputParameterOdbType(input: ParameterInput): OdbType {
  return input instanceof Column ? input.type : odbTypeFromPlsql(inputParameterType(input))
}

/** ODB type descriptors for use with named parameters and local variables. */
export const odbType = {
  /** Use a database-specific type not covered by the built-in descriptors. */
  custom<TType extends string>(type: TType, length?: number): OdbTypeDescriptor<TType> {
    return { type, length }
  },
  string(length?: number): OdbTypeDescriptor<'VARCHAR2'> {
    return { type: 'VARCHAR2', length }
  },
  raw(length?: number): OdbTypeDescriptor<'RAW'> {
    return { type: 'RAW', length }
  },
  number(): OdbTypeDescriptor<'NUMBER'> {
    return { type: 'NUMBER' }
  },
  integer(): OdbTypeDescriptor<'PLS_INTEGER'> {
    return { type: 'PLS_INTEGER' }
  },
  guid(): OdbTypeDescriptor<'VARCHAR2'> {
    return { type: 'VARCHAR2', length: 32 }
  },
  boolean(): OdbTypeDescriptor<'BOOLEAN'> {
    return { type: 'BOOLEAN' }
  },
  date(): OdbTypeDescriptor<'DATE'> {
    return { type: 'DATE' }
  },
  timestamp(): OdbTypeDescriptor<'TIMESTAMP'> {
    return { type: 'TIMESTAMP' }
  },
  clob(): OdbTypeDescriptor<'CLOB'> {
    return { type: 'CLOB' }
  },
  blob(): OdbTypeDescriptor<'BLOB'> {
    return { type: 'BLOB' }
  },
  resultset(): OdbTypeDescriptor<'SYS_REFCURSOR'> {
    return { type: 'SYS_REFCURSOR' }
  },
}

// ── Statement types ──────────────────────────────────────────────────────────

export type IfBranchNode = { condition: string; statements: StatementNode[] }

export type ForRangeNode = {
  kind: 'for-range'
  index: string
  from: string
  to: string
  statements: StatementNode[]
}

export type WhileNode = {
  kind: 'while'
  condition: string
  statements: StatementNode[]
}

export type CaseBranchNode = { condition: string; statements: StatementNode[] }

export type CaseNode = {
  kind: 'case'
  branches: CaseBranchNode[]
  elseStatements?: StatementNode[]
}

export type StatementNode =
  | { kind: 'assign'; target: string; value: string }
  | { kind: 'return'; value?: string }
  | { kind: 'null' }
  | { kind: 'commit' }
  | { kind: 'call'; sql: string }
  | { kind: 'raw'; sql: string }
  | { kind: 'if'; branches: IfBranchNode[]; elseStatements?: StatementNode[] }
  | ForRangeNode
  | WhileNode
  | CaseNode

export type OraclePredefinedException =
  | 'ACCESS_INTO_NULL'
  | 'CASE_NOT_FOUND'
  | 'COLLECTION_IS_NULL'
  | 'CURSOR_ALREADY_OPEN'
  | 'DUP_VAL_ON_INDEX'
  | 'INVALID_CURSOR'
  | 'INVALID_NUMBER'
  | 'LOGIN_DENIED'
  | 'NO_DATA_FOUND'
  | 'NOT_LOGGED_ON'
  | 'PROGRAM_ERROR'
  | 'ROWTYPE_MISMATCH'
  | 'SELF_IS_NULL'
  | 'STORAGE_ERROR'
  | 'SUBSCRIPT_BEYOND_COUNT'
  | 'SUBSCRIPT_OUTSIDE_LIMIT'
  | 'SYS_INVALID_ROWID'
  | 'TIMEOUT_ON_RESOURCE'
  | 'TOO_MANY_ROWS'
  | 'VALUE_ERROR'
  | 'ZERO_DIVIDE'

export type ExceptionHandlerNode = {
  when: OraclePredefinedException | 'OTHERS'
  statements: StatementNode[]
}

// ── AST node types ───────────────────────────────────────────────────────────

export type ProcedureBodyNode = {
  declarations: LocalVarNode[]
  localProcedures?: ProcedureNode[]
  localFunctions?: FunctionNode[]
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
  params?: OrdsServiceParameterGroups
}

export type ProcedureNode = {
  kind: 'procedure'
  name: string
  params: ParamNode[]
  autonomous?: boolean
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

export type PrivateConstantNode = {
  name: string
  type: PlsqlType | string
  length?: number
  substitution: string
}

export type OdbApplication = {
  kind: 'package'
  name: string
  procedures: ProcedureNode[]
  functions: FunctionNode[]
  privateProcedures?: ProcedureNode[]
  privateFunctions?: FunctionNode[]
  privateConstants?: PrivateConstantNode[]
}

export type ApplicationLike = OdbApplication | { application(): OdbApplication }

export function applicationNode(application: ApplicationLike): OdbApplication {
  return 'application' in application ? application.application() : application
}

export type PackageSqlOptions = {
  schema?: string
  orReplace?: boolean
  /** Values used by private constants declared with `privateConstant()`. */
  substitutions?: Record<string, string | number | boolean | null>
  /**
   * Physical object name to emit instead of the public name. Used by the
   * blue/green deployment flow to create the package under a colored name
   * (e.g. `PCK_APP_BLUE`) behind a stable synonym.
   */
  physicalName?: string
}

type PackageMemberDefinition = PlsqlFunction<any> | ProcedureDefinition<any>

type PackageMemberReturnValue<TMember extends PackageMemberDefinition> =
  TMember extends PlsqlFunction<infer TReturnType> ? PlsqlExpression<TReturnType> : PlsqlStatement

type PackageMemberInvoker<TMember extends PackageMemberDefinition> = (
  ...args: PlsqlRenderable[]
) => PackageMemberReturnValue<TMember>

type PackageShape<TMembers extends Record<string, PackageMemberDefinition>> = {
  [TKey in keyof TMembers]: PackageMemberInvoker<TMembers[TKey]>
}

/** Builder for a searched PL/SQL `CASE` statement. */
export class CaseStatementBuilder {
  private readonly branches: CaseBranchNode[] = []
  private elseStatements?: StatementNode[]

  constructor(
    private readonly buildStatements: (build: (body: ProcedureBody) => void) => StatementNode[],
  ) {}

  when(condition: PlsqlBooleanExpression, build: (body: ProcedureBody) => void): this {
    this.branches.push({ condition: condition.toSQL(), statements: this.buildStatements(build) })
    return this
  }

  else(build: (body: ProcedureBody) => void): this {
    if (this.elseStatements) throw new Error('case: ELSE branch is already defined.')
    this.elseStatements = this.buildStatements(build)
    return this
  }

  toNode(): CaseNode {
    if (this.branches.length === 0) throw new Error('case: at least one WHEN branch is required.')
    return { kind: 'case', branches: this.branches, elseStatements: this.elseStatements }
  }
}

// ── ProcedureBody ─────────────────────────────────────────────────────────────

export class ProcedureBody {
  private _declarations: LocalVar[] = []
  private _localProcedures: Procedure[] = []
  private _localFunctions: PlsqlFunction<any>[] = []
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

  private declareVariable(name: string, type: PlsqlType | string, length?: number): LocalVar {
    const opts = length === undefined ? {} : { length }
    const v =
      type === 'CLOB'
        ? new ClobVar(name, 'CLOB', opts)
        : type === 'BLOB'
          ? new BlobVar(name, 'BLOB', opts)
          : type === 'VARCHAR2'
            ? new Varchar2Var(name, 'VARCHAR2', opts)
            : new LocalVar(name, type, opts)
    this._declarations.push(v)
    return v
  }

  /**
   * Declare named local variables using automatic `l_` names and optional
   * column `%TYPE` anchors.
   *
   * @example
   * const { userId, token } = body.variables({
   *   userId: users.id,
   *   token: odbType.string(128),
   * })
   */
  variables<TInputs extends Record<string, LocalVariableInput>>(
    definitions: TInputs,
  ): LocalVariables<TInputs> {
    const variables = {} as LocalVariables<TInputs>
    for (const [key, input] of Object.entries(definitions)) {
      const definition = input as LocalVariableInput
      const type =
        typeof definition === 'object' && !(definition instanceof Column)
          ? definition.type
          : inputParameterType(definition as ParameterInput)
      const length =
        typeof definition === 'object' && !(definition instanceof Column)
          ? definition.length
          : undefined
      variables[key as keyof TInputs] = this.declareVariable(
        localVariableName(key),
        type,
        length,
      ) as LocalVariables<TInputs>[keyof TInputs]
    }
    return variables
  }

  /** Assign a compatible typed PL/SQL value or JavaScript literal. */
  set<T extends PlsqlType | string>(target: PlsqlReference<T>, value: PlsqlValue<NoInfer<T>>): this
  set<T extends PlsqlType | string>(
    target: PlsqlReference<T>,
    value: PlsqlLiteral<NoInfer<T>>,
  ): this
  set<T extends PlsqlType | string>(
    target: PlsqlReference<T>,
    value: PlsqlValue<NoInfer<T>> | PlsqlLiteral<NoInfer<T>>,
  ): this {
    this._statements.push({
      kind: 'assign',
      target: target.toSQL(),
      value: isPlsqlValue(value) ? value.toSQL() : renderPlsqlLiteral(value),
    })
    return this
  }

  /** `RETURN [value];` */
  return(value?: PlsqlRenderable | number | boolean | null): this {
    this._statements.push({
      kind: 'return',
      value:
        value === undefined
          ? undefined
          : isPlsqlValue(value)
            ? value.toSQL()
            : typeof value === 'string'
              ? value
              : renderPlsqlLiteral(value),
    })
    return this
  }

  /** `NULL;` */
  null(): this {
    this._statements.push({ kind: 'null' })
    return this
  }

  /** `COMMIT;` */
  commit(): this {
    this._statements.push({ kind: 'commit' })
    return this
  }

  /** Emit a typed PL/SQL procedure-call statement. */
  call(statement: PlsqlStatement): this {
    this._statements.push({ kind: 'call', sql: statement.toSQL() })
    return this
  }

  /** Emit an arbitrary SQL statement as-is. */
  raw(sql: string): this {
    this._statements.push({ kind: 'raw', sql })
    return this
  }

  /** Raise an explicit HTTP response handled by generated ORDS services. */
  httpError(status: number, code: string): this {
    if (!Number.isInteger(status) || status < 400 || status > 599) {
      throw new Error('httpError: status must be an integer from 400 through 599.')
    }
    if (!/^[A-Z][A-Z0-9_]{0,99}$/.test(code)) {
      throw new Error('httpError: code must be uppercase alphanumeric with optional underscores.')
    }
    return this.raw(`odb_http.raise_error(${status}, '${code}')`)
  }

  /** Raise a 401 HTTP response handled by generated ORDS services. */
  unauthorized(code = 'UNAUTHORIZED'): this {
    return this.httpError(401, code)
  }

  /** Raise a 403 HTTP response handled by generated ORDS services. */
  forbidden(code = 'FORBIDDEN'): this {
    return this.httpError(403, code)
  }

  /** Raise a 429 HTTP response handled by generated ORDS services. */
  tooManyRequests(code = 'TOO_MANY_REQUESTS'): this {
    return this.httpError(429, code)
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
   * Emit `SELECT ... INTO <result>;` followed by `RETURN <result>;` for a
   * function that returns a single queried value. A result variable typed to
   * the function's return type is declared automatically — no intermediate
   * local needed in the caller. Only valid inside a function body.
   *
   * @example
   * fn.body((body) =>
   *   body.returnQuery(odbQuery().selectFrom(usersTable).select('name').where('id', '=', pId)))
   */
  returnQuery(qb: AnyQueryBuilder & { into(...targets: PlsqlReference[]): unknown }): this {
    if (this._returnType === undefined) {
      throw new Error('returnQuery() can only be used inside a function body')
    }
    const name = this._returnCounter === 0 ? 'l_return' : `l_return${this._returnCounter}`
    this._returnCounter++
    const result = this.declareVariable(name, this._returnType, this._returnLength)
    qb.into(result)
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
   *   cond.eq(status, 200),
   *   (t) => t.set(rToken, issueToken),
   *   (e) => e.auditWarn('login failed'),
   * )
   */
  ifThen(
    condition: PlsqlBooleanExpression,
    buildThen: (body: ProcedureBody) => void,
    buildElse?: (body: ProcedureBody) => void,
  ): this {
    const node: StatementNode = {
      kind: 'if',
      branches: [{ condition: condition.toSQL(), statements: this.childStatements(buildThen) }],
    }
    if (buildElse) {
      node.elseStatements = this.childStatements(buildElse)
    }
    this._statements.push(node)
    return this
  }

  /** Add an `ELSIF` branch to the most recently declared `IF` statement. */
  elsif(condition: PlsqlBooleanExpression, build: (body: ProcedureBody) => void): this {
    const statement = this._statements.at(-1)
    if (!statement || statement.kind !== 'if') {
      throw new Error('elsif: must immediately follow ifThen() or another elsif().')
    }
    if (statement.elseStatements) throw new Error('elsif: cannot follow an ELSE branch.')
    statement.branches.push({
      condition: condition.toSQL(),
      statements: this.childStatements(build),
    })
    return this
  }

  /**
   * Emit `FOR <index> IN <from>..<to> LOOP ... END LOOP;`. The loop index is
   * an implicit `PLS_INTEGER` variable and is not separately declared.
   *
   * @example
   * body.forRange('attempt', 1, pRetries, (attempt, loop) =>
   *   loop.set(vResult, calculate(attempt)),
   * )
   */
  forRange(
    index: string,
    from: PlsqlRenderable | number,
    to: PlsqlRenderable | number,
    build: (index: LocalVar<'PLS_INTEGER'>, body: ProcedureBody) => void,
  ): this {
    const loopIndex = new LocalVar(localVariableName(index), 'PLS_INTEGER')
    const renderBound = (value: PlsqlRenderable | number) =>
      typeof value === 'number' ? String(value) : renderPlsql(value)
    this._statements.push({
      kind: 'for-range',
      index: loopIndex.name,
      from: renderBound(from),
      to: renderBound(to),
      statements: this.childStatements((body) => build(loopIndex, body)),
    })
    return this
  }

  /** Emit `WHILE <condition> LOOP ... END LOOP;`. */
  while(condition: PlsqlBooleanExpression, build: (body: ProcedureBody) => void): this {
    this._statements.push({
      kind: 'while',
      condition: condition.toSQL(),
      statements: this.childStatements(build),
    })
    return this
  }

  /** Emit a searched `CASE WHEN ... THEN ... [ELSE ...] END CASE;` statement. */
  case(build: (cases: CaseStatementBuilder) => void): this {
    const cases = new CaseStatementBuilder((branch) => this.childStatements(branch))
    build(cases)
    this._statements.push(cases.toNode())
    return this
  }

  /** Declare a procedure local to the enclosing procedure or function. */
  localProc(name: string, build?: (proc: Procedure) => void): Procedure {
    const procedure = new Procedure(name)
    build?.(procedure)
    this._localProcedures.push(procedure)
    return procedure
  }

  /** Declare a function local to the enclosing procedure or function. */
  localFunc<TReturnType extends PlsqlType | string>(
    name: string,
    returnType: TReturnType | OdbTypeDescriptor<TReturnType>,
    build?: (fn: PlsqlFunction<TReturnType>) => void,
  ): PlsqlFunction<TReturnType> {
    const definition = typeof returnType === 'object' ? returnType : { type: returnType }
    const fn = new PlsqlFunction(name, definition.type, { length: definition.length })
    build?.(fn)
    this._localFunctions.push(fn)
    return fn
  }

  /**
   * Add an `EXCEPTION` handler for a named exception. Handlers are emitted after
   * the body statements, in the order they are declared.
   *
   * @example
   * body.when('NO_DATA_FOUND', (h) => h.set(rError, 'not found'))
   */
  when(
    exceptionName: OraclePredefinedException | 'OTHERS',
    build: (body: ProcedureBody) => void,
  ): this {
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
      localProcedures:
        this._localProcedures.length > 0
          ? this._localProcedures.map((procedure) => procedure.toNode())
          : undefined,
      localFunctions:
        this._localFunctions.length > 0 ? this._localFunctions.map((fn) => fn.toNode()) : undefined,
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
  /** Overrides for automatically mapped ORDS parameter types, keyed by a PL/SQL argument or its derived camel-case name. */
  paramTypes?: Record<string, OrdsParamType>
  /** HTTP parameter bindings, grouped by transport and keyed by public name. */
  params?: OrdsServiceParameterGroups
}

/** Defaults applied to every ORDS service declared by a package. */
export type OdbPackageOptions = {
  /** ORDS module base path. Individual services can override this value. */
  basePath?: string
}

export type OrdsServiceParameterGroups = {
  /** IN values read from a JSON request body. */
  body?: Record<string, PlsqlReference>
  /** Values read from HTTP headers. */
  header?: Record<string, PlsqlReference>
  /** Values read from route parameters. */
  uri?: Record<string, PlsqlReference>
  /** OUT values returned in the JSON response. */
  response?: Record<string, PlsqlReference>
}

/** Transport bindings for a contract-first procedure. */
export type ProcedureServiceDefinition<TParameters extends ProcedureParameters> = Omit<
  OrdsServiceDefinition,
  'params'
> & {
  /** Direct typed bindings for JSON request-body values. */
  body?: Record<
    string,
    | ParameterGroup<TParameters, 'in'>[keyof ParameterGroup<TParameters, 'in'>]
    | ParameterGroup<TParameters, 'inOut'>[keyof ParameterGroup<TParameters, 'inOut'>]
  >
  /** Direct typed bindings for HTTP request headers. */
  headers?: Record<string, NamedParameters<TParameters>[keyof NamedParameters<TParameters>]>
  /** Direct typed bindings for route parameters. */
  uri?: Record<
    string,
    | ParameterGroup<TParameters, 'in'>[keyof ParameterGroup<TParameters, 'in'>]
    | ParameterGroup<TParameters, 'inOut'>[keyof ParameterGroup<TParameters, 'inOut'>]
  >
  /** Direct typed bindings for JSON response values. */
  response?: Record<
    string,
    | ParameterGroup<TParameters, 'out'>[keyof ParameterGroup<TParameters, 'out'>]
    | ParameterGroup<TParameters, 'inOut'>[keyof ParameterGroup<TParameters, 'inOut'>]
  >
}

/** A complete package procedure with typed parameters and implementation. */
export class ProcedureDefinition<TParameters extends ProcedureParameters> {
  constructor(
    private readonly procedure: Procedure,
    readonly parameters: NamedParameters<TParameters>,
  ) {}

  get name(): string {
    return this.procedure.name
  }

  autonomous(): this {
    this.procedure.autonomous()
    return this
  }

  /** @internal Attach a validated ORDS service contract. */
  attachService(definition: OrdsServiceDefinition): this {
    this.procedure.attachService(definition)
    return this
  }

  /** @internal Emit the procedure application node. */
  toNode(): ProcedureNode {
    return this.procedure.toNode()
  }
}

export type ProcedureBuildContext<TParameters extends ProcedureParameters> = {
  params: NamedParameters<TParameters>
  body: ProcedureBody
}

/** Attach an ORDS contract to a previously declared procedure. */
export function defineService<TParameters extends ProcedureParameters>(
  procedure: ProcedureDefinition<TParameters>,
  definition: ProcedureServiceDefinition<TParameters>,
): ProcedureDefinition<TParameters> {
  const directParams =
    definition.body || definition.headers || definition.uri || definition.response
      ? {
          body: definition.body,
          header: definition.headers,
          uri: definition.uri,
          response: definition.response,
        }
      : undefined
  const {
    body: _body,
    headers: _headers,
    uri: _uri,
    response: _response,
    ...serviceDefinition
  } = definition
  return procedure.attachService({
    ...serviceDefinition,
    params: directParams as OrdsServiceParameterGroups | undefined,
  })
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
  const transportOverrides = new Map<string, { name: string; transport: string }>()
  for (const [transport, parameters] of Object.entries(service.params ?? {})) {
    for (const [name, parameter] of Object.entries(parameters ?? {})) {
      transportOverrides.set(parameter.name.toUpperCase(), { name, transport })
    }
  }
  for (const param of procedure.params) {
    const parameterName = param.name.toUpperCase()
    const derivedName = oracleParameterName(param.name).toUpperCase()
    const overriddenType = typeOverrides.get(parameterName) ?? typeOverrides.get(derivedName)
    const transport = transportOverrides.get(parameterName)
    const ordsType = overriddenType ?? plsqlToOrdsType(param.type)
    endpoint.param(
      param.name,
      param.direction,
      ordsType,
      undefined,
      ordsType === 'RESULTSET'
        ? procedure.body?.resultSets?.[param.name.toUpperCase()]?.map((column) => ({ ...column }))
        : undefined,
      overriddenType === undefined ? (param.odbType ?? odbTypeFromPlsql(param.type)) : undefined,
      transport?.name,
      transport?.transport === 'header'
        ? 'HEADER'
        : transport?.transport === 'uri'
          ? 'URI'
          : transport?.transport === 'body'
            ? 'BODY'
            : transport?.transport === 'response'
              ? 'RESPONSE'
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
  private _autonomous = false

  constructor(
    readonly name: string,
    private readonly serviceDefaults: OdbPackageOptions = {},
  ) {}

  /**
   * Declare named IN, OUT, and IN OUT parameters with automatic `p_` names
   * and optional column `%TYPE` anchors.
   *
   * @example
   * const { userId, result } = proc.parameters({
   *   in: { userId: users.id },
   *   out: { result: odbType.string() },
   * })
   */
  parameters<TParameters extends ProcedureParameters>(
    definitions: TParameters,
  ): NamedParameters<TParameters> {
    const parameters = {} as NamedParameters<TParameters>
    for (const [direction, inputs] of Object.entries(definitions)) {
      for (const [key, input] of Object.entries(inputs ?? {})) {
        const definition = input as ParameterInput
        const parameter = new Param(
          inputParameterName(key),
          inputParameterType(definition),
          direction === 'out' ? 'OUT' : direction === 'inOut' ? 'IN OUT' : 'IN',
          {
            length:
              typeof definition === 'object' && !(definition instanceof Column)
                ? definition.length
                : undefined,
          },
          inputParameterOdbType(definition),
        )
        this._params.push(parameter)
        Object.assign(parameters, { [key]: parameter })
      }
    }
    return parameters
  }

  /** Execute this procedure as an autonomous transaction. */
  autonomous(): this {
    this._autonomous = true
    return this
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

  /** Build an unqualified call suitable for a local procedure declaration. */
  invoke(...args: PlsqlRenderable[]): PlsqlStatement {
    return new PlsqlStatement(`${this.name}(${args.map(renderPlsql).join(', ')})`)
  }

  /** @internal Used by defineService() to attach a validated ORDS service contract. */
  attachService(definition: OrdsServiceDefinition): this {
    const declaredParameters = new Set(this._params)
    const mappedParameters = new Set<Param>()
    const routeParameters = new Set(
      Array.from(definition.path.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g), (match) => match[1]),
    )
    const mappedRouteParameters = new Set<string>()

    for (const [transport, bindings] of Object.entries(definition.params ?? {})) {
      for (const [publicName, parameter] of Object.entries(bindings ?? {})) {
        if (!declaredParameters.has(parameter as Param)) {
          throw new Error(`ORDS service ${this.name}: ${publicName} is not a procedure parameter.`)
        }
        if (mappedParameters.has(parameter as Param)) {
          throw new Error(
            `ORDS service ${this.name}: parameter ${(parameter as Param).name} is bound more than once.`,
          )
        }
        const direction = (parameter as Param).toNode().direction
        if (
          (transport === 'body' || transport === 'uri') &&
          direction !== 'IN' &&
          direction !== 'IN OUT'
        ) {
          throw new Error(
            `ORDS service ${this.name}: ${transport} binding ${publicName} must reference an IN or IN OUT parameter.`,
          )
        }
        if (transport === 'response' && direction !== 'OUT' && direction !== 'IN OUT') {
          throw new Error(
            `ORDS service ${this.name}: response binding ${publicName} must reference an OUT or IN OUT parameter.`,
          )
        }
        if (transport === 'uri') mappedRouteParameters.add(publicName)
        mappedParameters.add(parameter as Param)
      }
    }

    for (const parameter of this._params) {
      if (!mappedParameters.has(parameter)) {
        throw new Error(`ORDS service ${this.name}: parameter ${parameter.name} is not bound.`)
      }
    }
    for (const routeParameter of routeParameters) {
      if (!mappedRouteParameters.has(routeParameter)) {
        throw new Error(
          `ORDS service ${this.name}: route parameter :${routeParameter} has no URI binding.`,
        )
      }
    }
    for (const mappedRouteParameter of mappedRouteParameters) {
      if (!routeParameters.has(mappedRouteParameter)) {
        throw new Error(
          `ORDS service ${this.name}: URI binding ${mappedRouteParameter} has no route parameter.`,
        )
      }
    }
    const basePath = definition.basePath ?? this.serviceDefaults.basePath
    this._service = {
      ...definition,
      path: normalizeServicePath(definition.path),
      basePath: basePath ? normalizeBasePath(basePath) : undefined,
      paramTypes: definition.paramTypes ? { ...definition.paramTypes } : undefined,
      params: definition.params ? { ...definition.params } : undefined,
    }
    return this
  }

  toNode(): ProcedureNode {
    return {
      kind: 'procedure',
      name: this.name,
      params: this._params.map((p) => p.toNode()),
      autonomous: this._autonomous || undefined,
      body: this._body?.toNode(),
      service: this._service
        ? {
            ...this._service,
            paramTypes: this._service.paramTypes ? { ...this._service.paramTypes } : undefined,
            params: this._service.params ? { ...this._service.params } : undefined,
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
    returnTypeOptions: { length?: number } = {},
  ) {
    this._returnTypeOptions = { ...returnTypeOptions }
  }

  /** Set the length qualifier on the return type (e.g. for VARCHAR2). */
  returnLength(n: number): this {
    this._returnTypeOptions.length = n
    return this
  }

  /**
   * Declare named IN parameters with automatic `p_` names. Functions only
   * accept IN parameters because their callers use expression syntax.
   */
  parameters<TParameters extends FunctionParameters>(
    definitions: TParameters,
  ): InputParameters<TParameters['in']> {
    const parameters = {} as InputParameters<TParameters['in']>
    for (const [key, input] of Object.entries(definitions.in)) {
      const definition = input as ParameterInput
      const parameter = new Param(
        inputParameterName(key),
        inputParameterType(definition),
        'IN',
        {
          length:
            typeof definition === 'object' && !(definition instanceof Column)
              ? definition.length
              : undefined,
        },
        inputParameterOdbType(definition),
      )
      this._params.push(parameter)
      Object.assign(parameters, { [key]: parameter })
    }
    return parameters
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

  /** Build an unqualified call suitable for use by another member of this package. */
  invoke(...args: PlsqlRenderable[]): PlsqlExpression<TReturnType> {
    return new PlsqlExpression(this.returnType, `${this.name}(${args.map(renderPlsql).join(', ')})`)
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
  proc<TParameters extends ProcedureParameters>(
    name: string,
    parameters: TParameters,
    build: (context: ProcedureBuildContext<TParameters>) => void,
  ): ProcedureDefinition<TParameters>
  privateProc(name: string, build?: (proc: Procedure) => void): Procedure
  func<TReturnType extends PlsqlType | string = PlsqlType | string>(
    name: string,
    returnType: TReturnType | OdbTypeDescriptor<TReturnType>,
    build?: (fn: PlsqlFunction<TReturnType>) => void,
  ): PlsqlFunction<TReturnType>
  privateFunc<TReturnType extends PlsqlType | string = PlsqlType | string>(
    name: string,
    returnType: TReturnType | OdbTypeDescriptor<TReturnType>,
    build?: (fn: PlsqlFunction<TReturnType>) => void,
  ): PlsqlFunction<TReturnType>
  privateConstant<TType extends PlsqlType | string>(
    name: string,
    type: TType | OdbTypeDescriptor<TType>,
    substitution: string,
  ): PlsqlExpression<TType>
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
  private _procedures: ProcedureDefinition<any>[] = []
  private _functions: PlsqlFunction<any>[] = []
  private _privateProcedures: Procedure[] = []
  private _privateFunctions: PlsqlFunction<any>[] = []
  private _privateConstants: PrivateConstantNode[] = []
  private _memberLookup: Record<string, PackageMemberDefinition> = {}

  /**
   * Marks this artifact for blue/green deployment. The migration layer creates
   * the package under a colored physical name and repoints a stable synonym,
   * so live callers (ORDS handlers, jobs) are never blocked by a recompile.
   */
  readonly isBlueGreen = true as const

  constructor(
    readonly name: string,
    private readonly serviceDefaults: OdbPackageOptions = {},
  ) {}

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

    const rendered = args.map(renderPlsql).join(', ')
    if (!(member instanceof PlsqlFunction)) {
      return new PlsqlStatement(
        `${this.name}.${member.name}(${rendered})`,
      ) as PackageMemberReturnValue<PackageMemberDefinition>
    }
    return new PlsqlExpression(
      member.returnType,
      `${this.name}.${member.name}(${rendered})`,
    ) as PackageMemberReturnValue<PackageMemberDefinition>
  }

  proc<TParameters extends ProcedureParameters>(
    name: string,
    parameters: TParameters,
    build: (context: ProcedureBuildContext<TParameters>) => void,
  ): ProcedureDefinition<TParameters> {
    const procedure = new Procedure(name, this.serviceDefaults)
    const definition = new ProcedureDefinition(procedure, procedure.parameters(parameters))
    procedure.body((body) => build({ params: definition.parameters, body }))
    this._procedures.push(definition)
    return definition
  }

  privateProc(name: string, build?: (proc: Procedure) => void): Procedure {
    const p = new Procedure(name)
    build?.(p)
    this._privateProcedures.push(p)
    return p
  }

  func<TReturnType extends PlsqlType | string = PlsqlType | string>(
    name: string,
    returnType: TReturnType | OdbTypeDescriptor<TReturnType>,
    build?: (fn: PlsqlFunction<TReturnType>) => void,
  ): PlsqlFunction<TReturnType> {
    const definition = typeof returnType === 'object' ? returnType : { type: returnType }
    const f = new PlsqlFunction(name, definition.type, { length: definition.length })
    build?.(f)
    this._functions.push(f)
    return f
  }

  privateFunc<TReturnType extends PlsqlType | string = PlsqlType | string>(
    name: string,
    returnType: TReturnType | OdbTypeDescriptor<TReturnType>,
    build?: (fn: PlsqlFunction<TReturnType>) => void,
  ): PlsqlFunction<TReturnType> {
    const definition = typeof returnType === 'object' ? returnType : { type: returnType }
    const f = new PlsqlFunction(name, definition.type, { length: definition.length })
    build?.(f)
    this._privateFunctions.push(f)
    return f
  }

  /**
   * Declare a body-private constant whose value is supplied when SQL is
   * generated. The returned expression can be used by package members.
   */
  privateConstant<TType extends PlsqlType | string>(
    name: string,
    type: TType | OdbTypeDescriptor<TType>,
    substitution: string,
  ): PlsqlExpression<TType> {
    const definition = typeof type === 'object' ? type : { type }
    this._privateConstants.push({
      name,
      type: definition.type,
      length: definition.length,
      substitution,
    })
    return new PlsqlExpression(definition.type, name)
  }

  /**
   * Build a typed call expression to a member of this package, e.g.
   * `pck_api_settings.get_value('APP_VERSION')`. The return type is inferred
   * from the declared function (defaults to VARCHAR2). Callers reference the
   * package by name and rely on definer rights for schema resolution.
   *
   * @example
   * body.query(
   *   odbQuery().selectFrom('dual').select(settings.call('get_value', odbLiteral('APP_VERSION'))).into(pVersion))
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
      procedures: this._procedures.map((procedure) => procedure.toNode()),
      functions: this._functions.map((f) => f.toNode()),
      privateProcedures: this._privateProcedures.map((p) => p.toNode()),
      privateFunctions: this._privateFunctions.map((f) => f.toNode()),
      privateConstants: this._privateConstants.map((constant) => ({ ...constant })),
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

  for (const constant of pkg.privateConstants ?? []) {
    const value = options.substitutions?.[constant.substitution]
    if (value === undefined) {
      throw new Error(`Package ${pkg.name}: missing substitution ${constant.substitution}.`)
    }
    lines.push(
      `  ${constant.name} CONSTANT ${emitPlsqlType(constant.type, { length: constant.length })} := ${renderPlsqlLiteral(value)};`,
    )
  }

  for (const proc of pkg.privateProcedures ?? []) {
    lines.push(emitProcedureImpl(proc))
  }

  for (const fn of pkg.privateFunctions ?? []) {
    lines.push(emitFunctionImpl(fn))
  }

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
  return emitProcedureImplAt(proc, '  ')
}

function emitProcedureImplAt(proc: ProcedureNode, indent: string): string {
  const params = proc.params.map(emitParamDef).join(', ')
  const sig = `${indent}PROCEDURE ${proc.name}(${params}) IS`

  if (!proc.body) {
    return [sig, `${indent}BEGIN`, `${indent}  NULL;`, `${indent}END ${proc.name};`].join('\n')
  }

  const lines: string[] = [sig]

  if (proc.autonomous) lines.push(`${indent}  PRAGMA AUTONOMOUS_TRANSACTION;`)

  for (const decl of proc.body.declarations) {
    lines.push(`${indent}  ${emitLocalVarDecl(decl)}`)
  }
  for (const localProcedure of proc.body.localProcedures ?? []) {
    lines.push(emitProcedureImplAt(localProcedure, `${indent}  `))
  }
  for (const localFunction of proc.body.localFunctions ?? []) {
    lines.push(emitFunctionImplAt(localFunction, `${indent}  `))
  }

  lines.push(`${indent}BEGIN`)
  lines.push(...emitStatementBlock(proc.body.statements, `${indent}  `))
  emitExceptionSection(lines, proc.body.exceptionHandlers, indent)
  lines.push(`${indent}END ${proc.name};`)
  return lines.join('\n')
}

function emitFunctionImpl(fn: FunctionNode): string {
  return emitFunctionImplAt(fn, '  ')
}

function emitFunctionImplAt(fn: FunctionNode, indent: string): string {
  const params = fn.params.map(emitParamDef).join(', ')
  const ret = emitParamType(fn.returnType)
  const sig = `${indent}FUNCTION ${fn.name}(${params}) RETURN ${ret} IS`

  if (!fn.body) {
    return [sig, `${indent}BEGIN`, `${indent}  RETURN NULL;`, `${indent}END ${fn.name};`].join('\n')
  }

  const lines: string[] = [sig]

  for (const decl of fn.body.declarations) {
    lines.push(`${indent}  ${emitLocalVarDecl(decl)}`)
  }
  for (const localProcedure of fn.body.localProcedures ?? []) {
    lines.push(emitProcedureImplAt(localProcedure, `${indent}  `))
  }
  for (const localFunction of fn.body.localFunctions ?? []) {
    lines.push(emitFunctionImplAt(localFunction, `${indent}  `))
  }

  lines.push(`${indent}BEGIN`)

  if (fn.body.statements.length === 0) {
    lines.push(`${indent}  RETURN NULL;`)
  } else {
    lines.push(...emitStatementBlock(fn.body.statements, `${indent}  `))
  }

  emitExceptionSection(lines, fn.body.exceptionHandlers, indent)
  lines.push(`${indent}END ${fn.name};`)
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
    case 'commit':
      return [`${indent}COMMIT;`]
    case 'call':
      return [`${indent}${stmt.sql};`]
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
    case 'for-range':
      return [
        `${indent}FOR ${stmt.index} IN ${stmt.from}..${stmt.to} LOOP`,
        ...emitStatementBlock(stmt.statements, `${indent}  `),
        `${indent}END LOOP;`,
      ]
    case 'while':
      return [
        `${indent}WHILE ${stmt.condition} LOOP`,
        ...emitStatementBlock(stmt.statements, `${indent}  `),
        `${indent}END LOOP;`,
      ]
    case 'case': {
      const lines = [`${indent}CASE`]
      for (const branch of stmt.branches) {
        lines.push(`${indent}  WHEN ${branch.condition} THEN`)
        lines.push(...emitStatementBlock(branch.statements, `${indent}    `))
      }
      if (stmt.elseStatements) {
        lines.push(`${indent}  ELSE`)
        lines.push(...emitStatementBlock(stmt.elseStatements, `${indent}    `))
      }
      lines.push(`${indent}END CASE;`)
      return lines
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export const odbPackage: {
  <TMembers extends Record<string, PackageMemberDefinition>>(
    name: string,
    build?: (pkg: PackageImpl<any>) => TMembers | void,
  ): Package<TMembers>
  <TMembers extends Record<string, PackageMemberDefinition>>(
    name: string,
    options: OdbPackageOptions,
    build?: (pkg: PackageImpl<any>) => TMembers | void,
  ): Package<TMembers>
} = function <TMembers extends Record<string, PackageMemberDefinition>>(
  name: string,
  optionsOrBuild?: OdbPackageOptions | ((pkg: PackageImpl<any>) => TMembers | void),
  build?: (pkg: PackageImpl<any>) => TMembers | void,
): Package<TMembers> {
  const options = typeof optionsOrBuild === 'function' ? {} : (optionsOrBuild ?? {})
  const packageBuild = typeof optionsOrBuild === 'function' ? optionsOrBuild : build
  const pkg = new PackageImpl<TMembers>(name, options)
  const result = packageBuild?.(pkg)

  if (result && typeof result === 'object') {
    for (const [key, member] of Object.entries(result)) {
      pkg['registerInvoker'](key, member as PackageMemberDefinition)
    }
  }

  return pkg as unknown as Package<TMembers>
}
