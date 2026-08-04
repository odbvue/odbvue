// ── Types ─────────────────────────────────────────────────────────────────────

export type OrdsHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Native ORDS parameter type.
 * https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/18.3/aelig/ords-database-type-mappings.html
 */
export type OrdsParamType =
  | 'STRING'
  | 'INT'
  | 'DOUBLE'
  | 'BOOLEAN'
  | 'LONG'
  | 'TIMESTAMP'
  | 'RESULTSET'

export type OrdsParamDirection = 'IN' | 'OUT' | 'IN OUT'

export type OrdsResultColumnNode = {
  name: string
  type: 'string' | 'number' | 'guid' | 'boolean' | 'date' | 'timestamp' | 'clob'
  nullable: boolean
}

// ── AST node types ────────────────────────────────────────────────────────────

export type OrdsParamNode = {
  kind: 'ords_param'
  plsqlArg: string
  name: string
  bindVariable: string
  direction: OrdsParamDirection
  paramType: OrdsParamType
  sourceType: 'HEADER' | 'RESPONSE' | 'URI'
  comment?: string
  resultColumns?: OrdsResultColumnNode[]
}

export type OrdsEndpointNode = {
  kind: 'ords_endpoint'
  module: string
  basePath: string
  packageName: string
  procedureName: string
  method: OrdsHttpMethod
  pattern: string
  source: string
  params: OrdsParamNode[]
  comment?: string
}

export type OrdsSchemaNode = {
  kind: 'ords_schema'
  schema: string
  urlMappingType: 'BASE_PATH' | 'BASE_URL'
  urlMappingPattern: string
  autoRestAuth: boolean
}

export type OrdsEndpointSqlOptions = {
  /**
   * Target schema. When provided, ORDS registration runs inside a temporary
   * definer-rights procedure created in that schema so the resulting module,
   * templates, and handlers are owned by the intended parsing schema instead
   * of the ADMIN session used by the CLI.
   */
  schema?: string
  /** Define the owning module before its template. Defaults to true. */
  defineModule?: boolean
}

// ── OrdsParam ─────────────────────────────────────────────────────────────────

export class OrdsParam {
  constructor(
    readonly plsqlArg: string,
    readonly direction: OrdsParamDirection,
    readonly paramType: OrdsParamType,
    readonly comment?: string,
    readonly resultColumns?: OrdsResultColumnNode[],
  ) {}

  /**
   * User-facing name and bind variable: strips leading P_/R_ prefix,
   * lowercases, and replaces _ with - (matches prc_ordsify convention).
   * e.g. P_USER_NAME → user-name
   */
  get name(): string {
    const raw = /^[PR]_/i.test(this.plsqlArg) ? this.plsqlArg.slice(2) : this.plsqlArg
    return raw.toLowerCase().replace(/_/g, '-')
  }

  get bindVariable(): string {
    return this.name
  }

  get sourceType(): 'HEADER' | 'RESPONSE' {
    return this.direction === 'OUT' ? 'RESPONSE' : 'HEADER'
  }

  toNode(sourceType: OrdsParamNode['sourceType'] = this.sourceType): OrdsParamNode {
    return {
      kind: 'ords_param',
      plsqlArg: this.plsqlArg,
      name: this.name,
      bindVariable: this.bindVariable,
      direction: this.direction,
      paramType: this.paramType,
      sourceType,
      comment: this.comment,
      resultColumns: this.resultColumns?.map((column) => ({ ...column })),
    }
  }

  toObject() {
    return this.toNode()
  }
}

// ── OrdsEndpoint ──────────────────────────────────────────────────────────────

export class OrdsEndpoint {
  private _method?: OrdsHttpMethod
  private _pattern?: string
  private _basePath?: string
  private _params: OrdsParam[] = []
  private _comment?: string

  constructor(
    /** ORDS module name (typically derived from the package name). */
    readonly module: string,
    /** PL/SQL package name. */
    readonly packageName: string,
    /** PL/SQL procedure name. */
    readonly procedureName: string,
  ) {}

  /**
   * Override the HTTP method. If omitted it is inferred from the procedure
   * name prefix (GET_ → GET, POST_ → POST, PUT_ → PUT, DELETE_ → DELETE).
   */
  method(m: OrdsHttpMethod): this {
    this._method = m
    return this
  }

  /**
   * Override the module base path. Defaults to `<module>/`.
   */
  basePath(path: string): this {
    this._basePath = path
    return this
  }

  /**
   * Override the URL pattern. If omitted it is derived from the procedure
   * name: the HTTP method prefix is stripped, underscores become dashes, and
   * for GET endpoints required IN params are appended as path segments.
   *
   * @example 'users/:id'
   */
  pattern(p: string): this {
    this._pattern = p
    return this
  }

  /**
   * Add a PL/SQL parameter binding.
   *
   * @param plsqlArg  Exact argument name as declared in PL/SQL (e.g. `P_USER_ID`).
   * @param direction `IN`, `OUT`, or `IN OUT`.
   * @param type      ORDS type — use `RESULTSET` for SYS_REFCURSOR, `INT` for PLS_INTEGER.
   * @param comment   Optional description surfaced in the ORDS catalogue.
   */
  param(
    plsqlArg: string,
    direction: OrdsParamDirection,
    type: OrdsParamType,
    comment?: string,
    resultColumns?: OrdsResultColumnNode[],
  ): this {
    this._params.push(new OrdsParam(plsqlArg, direction, type, comment, resultColumns))
    return this
  }

  comment(c: string): this {
    this._comment = c
    return this
  }

  get effectiveMethod(): OrdsHttpMethod {
    if (this._method) return this._method
    const name = this.procedureName.toUpperCase()
    if (name.startsWith('GET_')) return 'GET'
    if (name.startsWith('POST_')) return 'POST'
    if (name.startsWith('PUT_')) return 'PUT'
    if (name.startsWith('DELETE_')) return 'DELETE'
    return 'GET'
  }

  get effectivePattern(): string {
    if (this._pattern !== undefined) return this._pattern

    // Strip HTTP method prefix
    let name = this.procedureName.toUpperCase()
    for (const prefix of ['GET_', 'POST_', 'PUT_', 'DELETE_']) {
      if (name.startsWith(prefix)) {
        name = name.slice(prefix.length)
        break
      }
    }
    const base = name.toLowerCase().replace(/_/g, '-')

    // For GET, append IN params as path segments (prc_ordsify convention)
    if (this.effectiveMethod === 'GET') {
      const pathParts = this._params
        .filter((p) => p.direction === 'IN')
        .map((p) => `:${p.bindVariable}`)
      return pathParts.length > 0 ? `${base}/${pathParts.join('/')}` : base
    }

    return base
  }

  get effectiveBasePath(): string {
    return this._basePath ?? `${this.module}/`
  }

  private get handlerSource(): string {
    const args = this._params
      .map((p) => `${p.plsqlArg.toLowerCase()} => :${p.bindVariable}`)
      .join(', ')
    return `BEGIN ${this.packageName.toLowerCase()}.${this.procedureName.toLowerCase()}(${args}); END;`
  }

  private paramSourceType(param: OrdsParam): OrdsParamNode['sourceType'] {
    if (param.direction === 'OUT') return 'RESPONSE'
    const pathParams = new Set(
      [...this.effectivePattern.matchAll(/:([a-zA-Z0-9_-]+)\??/g)].map((match) => match[1]),
    )
    return pathParams.has(param.name) ? 'URI' : 'HEADER'
  }

  toNode(): OrdsEndpointNode {
    return {
      kind: 'ords_endpoint',
      module: this.module,
      basePath: this.effectiveBasePath,
      packageName: this.packageName,
      procedureName: this.procedureName,
      method: this.effectiveMethod,
      pattern: this.effectivePattern,
      source: this.handlerSource,
      params: this._params.map((p) => p.toNode(this.paramSourceType(p))),
      comment: this._comment,
    }
  }

  toObject() {
    return this.toNode()
  }

  toSQLUp(options: OrdsEndpointSqlOptions = {}): string {
    const pattern = this.effectivePattern
    const method = this.effectiveMethod
    const comment = sqlStr(this._comment)
    const source = `'${this.handlerSource.replace(/'/g, "''")}'`
    const moduleSql =
      options.defineModule === false
        ? []
        : [
            `  ords.define_module(`,
            `    p_module_name    => '${this.module}',`,
            `    p_base_path      => '${this.effectiveBasePath}',`,
            `    p_items_per_page => 0,`,
            `    p_comments       => ${comment}`,
            `  );`,
            `  COMMIT;`,
            '',
          ]
    const body = [
      ...moduleSql,
      `  ords.define_template(`,
      `    p_module_name => '${this.module}',`,
      `    p_pattern     => '${pattern}',`,
      `    p_comments    => ${comment}`,
      `  );`,
      `  COMMIT;`,
      '',
      `  ords.define_handler(`,
      `    p_module_name    => '${this.module}',`,
      `    p_pattern        => '${pattern}',`,
      `    p_method         => '${method}',`,
      `    p_source_type    => ords.source_type_plsql,`,
      `    p_source         => ${source},`,
      `    p_items_per_page => 0,`,
      `    p_comments       => ${comment}`,
      `  );`,
      `  COMMIT;`,
      ...this._params.flatMap((p) => {
        if (p.plsqlArg.toUpperCase() === 'P_BODY') return []
        return [
          '',
          `  ords.define_parameter(`,
          `    p_module_name        => '${this.module}',`,
          `    p_pattern            => '${pattern}',`,
          `    p_method             => '${method}',`,
          `    p_name               => '${p.name}',`,
          `    p_bind_variable_name => '${p.bindVariable}',`,
          `    p_source_type        => '${this.paramSourceType(p)}',`,
          `    p_param_type         => '${p.paramType}',`,
          `    p_access_method      => '${p.direction}',`,
          `    p_comments           => ${sqlStr(p.comment)}`,
          `  );`,
          `  COMMIT;`,
        ]
      }),
    ]

    if (!options.schema) {
      return plsqlBlock(body)
    }

    return wrapInSchemaProcedure(
      options.schema,
      tempOrdsProcedureName(this.module, this.procedureName, 'up'),
      body,
    )
  }

  /**
   * Drops the ORDS module for this endpoint (which removes all templates,
   * handlers and parameters within it). Oracle ORDS only exposes
   * ORDS.DELETE_MODULE — there is no DELETE_TEMPLATE API.
   */
  toSQLDown(options: OrdsEndpointSqlOptions = {}): string {
    const body = [
      `  ords.delete_module(`,
      `    p_module_name => '${this.module}'`,
      `  );`,
      `  COMMIT;`,
    ]

    if (!options.schema) {
      return plsqlBlock(body)
    }

    return wrapInSchemaProcedure(
      options.schema,
      tempOrdsProcedureName(this.module, this.procedureName, 'down'),
      body,
    )
  }
}

// ── OrdsSchema ────────────────────────────────────────────────────────────────

export class OrdsSchema {
  private _urlMappingType: 'BASE_PATH' | 'BASE_URL' = 'BASE_PATH'
  private _urlMappingPattern?: string
  private _autoRestAuth = false

  constructor(readonly schema: string) {}

  urlMappingType(type: 'BASE_PATH' | 'BASE_URL'): this {
    this._urlMappingType = type
    return this
  }

  urlMappingPattern(pattern: string): this {
    this._urlMappingPattern = pattern
    return this
  }

  autoRestAuth(enabled = true): this {
    this._autoRestAuth = enabled
    return this
  }

  toNode(): OrdsSchemaNode {
    const schema = this.schema.toLowerCase()
    return {
      kind: 'ords_schema',
      schema,
      urlMappingType: this._urlMappingType,
      urlMappingPattern: this._urlMappingPattern ?? schema,
      autoRestAuth: this._autoRestAuth,
    }
  }

  toObject() {
    return this.toNode()
  }

  toSQLUp(): string {
    const schema = this.schema.toLowerCase()
    const pattern = this._urlMappingPattern ?? schema
    return plsqlBlock([
      `  ords.enable_schema(`,
      `    p_enabled             => TRUE,`,
      `    p_schema              => '${schema}',`,
      `    p_url_mapping_type    => '${this._urlMappingType}',`,
      `    p_url_mapping_pattern => '${pattern}',`,
      `    p_auto_rest_auth      => ${this._autoRestAuth ? 'TRUE' : 'FALSE'}`,
      `  );`,
      `  COMMIT;`,
    ])
  }

  toSQLDown(): string {
    const schema = this.schema.toLowerCase()
    return plsqlBlock([
      `  ords.enable_schema(`,
      `    p_enabled => FALSE,`,
      `    p_schema  => '${schema}'`,
      `  );`,
      `  COMMIT;`,
    ])
  }
}

// ── Factories ─────────────────────────────────────────────────────────────────

export function odbOrdsSchema(schema: string, build?: (o: OrdsSchema) => void): OrdsSchema {
  const o = new OrdsSchema(schema)
  build?.(o)
  return o
}

export function odbOrdsEndpoint(
  module: string,
  packageName: string,
  procedureName: string,
  build?: (e: OrdsEndpoint) => void,
): OrdsEndpoint {
  const e = new OrdsEndpoint(module, packageName, procedureName)
  build?.(e)
  return e
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sqlStr(value: string | undefined): string {
  return value !== undefined ? `'${value.replace(/'/g, "''")}'` : 'NULL'
}

function plsqlBlock(body: string[]): string {
  return ['BEGIN', ...body, 'END;', '/'].join('\n')
}

function qualifyName(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

function tempOrdsProcedureName(
  module: string,
  procedureName: string,
  direction: 'up' | 'down',
): string {
  const base = `OV_ORDS_${direction}_${module}_${procedureName}`
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
  const hash = shortHash(base)
  const prefix = base.slice(0, Math.max(1, 30 - hash.length - 1))
  return `${prefix}_${hash}`
}

function shortHash(value: string): string {
  let hash = 0

  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }

  return hash.toString(36).toUpperCase().slice(0, 6)
}

function wrapInSchemaProcedure(schema: string, procedureName: string, body: string[]): string {
  const qualifiedProcedure = qualifyName(procedureName, schema)

  return [
    `CREATE OR REPLACE PROCEDURE ${qualifiedProcedure} AS`,
    'BEGIN',
    ...body,
    `END ${procedureName};`,
    '/',
    'BEGIN',
    `  ${qualifiedProcedure};`,
    'END;',
    '/',
    `DROP PROCEDURE ${qualifiedProcedure};`,
  ].join('\n')
}
