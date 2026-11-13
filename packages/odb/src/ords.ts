// ── Types ─────────────────────────────────────────────────────────────────────

import {
  emitOracleType,
  oracleParameterName,
  toKebabCase,
  type OdbOrdsType,
  type OdbType,
} from './model.js'
import type { ColumnType } from './schema/column.js'
import { ODB_ERROR_NUMBER, ODB_ERROR_STATUS } from './schema/errors.js'
import { odbHttp } from './helpers/http/http.js'
import { CURSOR_PAGE_DEFAULTS } from './constants.js'
import { cursorValueSql, type CursorPageOptions, type CursorQueryMetadata } from './pagination.js'

export type OrdsHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type ServiceAuthorization =
  | 'anonymous'
  | 'authenticated'
  | ({ match?: 'all' | 'any' } & (
      | { roles: readonly [string, ...string[]]; permissions?: readonly [string, ...string[]] }
      | { roles?: readonly [string, ...string[]]; permissions: readonly [string, ...string[]] }
    ))

export function validateServiceAuthorization(auth: ServiceAuthorization): void {
  if (auth === 'anonymous' || auth === 'authenticated') return
  if (!auth || typeof auth !== 'object' || (!auth.roles?.length && !auth.permissions?.length)) {
    throw new Error(
      'Service auth requires anonymous, authenticated, or non-empty roles/permissions.',
    )
  }
  if (auth.match !== undefined && auth.match !== 'all' && auth.match !== 'any') {
    throw new Error('Service auth match must be all or any.')
  }
  for (const names of [auth.roles, auth.permissions]) {
    if (names !== undefined && (!Array.isArray(names) || !names.length)) {
      throw new Error('Service auth roles/permissions must be non-empty arrays.')
    }
    for (const name of names ?? []) {
      if (typeof name !== 'string' || !name.trim() || name.length > 200) {
        throw new Error('Service auth names must contain 1 to 200 characters.')
      }
    }
  }
}

/**
 * Native ORDS parameter type.
 * https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/18.3/aelig/ords-database-type-mappings.html
 */
export type OrdsParamType = OdbOrdsType

export type OrdsParamDirection = 'IN' | 'OUT' | 'IN OUT'

export type OrdsResultColumnNode = {
  name: string
  type: ColumnType
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
  odbType?: OdbType
  sourceType: 'BODY' | 'HEADER' | 'RESPONSE' | 'URI'
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
  auth?: ServiceAuthorization
  responseMediaType?: string
  responseStatus?: number
  cursorPage?: Required<CursorPageOptions> & CursorQueryMetadata
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
  /** Define the template before its handler. Defaults to true. */
  defineTemplate?: boolean
}

// ── OrdsParam ─────────────────────────────────────────────────────────────────

export class OrdsParam {
  constructor(
    readonly plsqlArg: string,
    readonly direction: OrdsParamDirection,
    readonly paramType: OrdsParamType,
    readonly comment?: string,
    readonly resultColumns?: OrdsResultColumnNode[],
    readonly odbType?: OdbType,
    private readonly nameOverride?: string,
    private readonly sourceTypeOverride?: 'BODY' | 'HEADER' | 'RESPONSE' | 'URI',
  ) {}

  /**
   * User-facing name and bind variable: strips leading P_/R_ prefix,
   * lowercases, and replaces _ with - (matches prc_ordsify convention).
   * e.g. P_USER_NAME → user-name
   */
  get name(): string {
    return this.nameOverride ?? oracleParameterName(this.plsqlArg, { style: 'kebab' })
  }

  get bindVariable(): string {
    return oracleParameterName(this.plsqlArg)
  }

  get sourceType(): 'BODY' | 'HEADER' | 'RESPONSE' | 'URI' {
    return this.sourceTypeOverride ?? (this.direction === 'OUT' ? 'RESPONSE' : 'HEADER')
  }

  get hasSourceTypeOverride(): boolean {
    return this.sourceTypeOverride !== undefined
  }

  toNode(sourceType: OrdsParamNode['sourceType'] = this.sourceType): OrdsParamNode {
    return {
      kind: 'ords_param',
      plsqlArg: this.plsqlArg,
      name: this.name,
      bindVariable: this.bindVariable,
      direction: this.direction,
      paramType: this.paramType,
      odbType: this.odbType,
      sourceType,
      comment: this.comment,
      resultColumns: this.resultColumns?.map((column) => ({ ...column })),
    }
  }
}

// ── OrdsEndpoint ──────────────────────────────────────────────────────────────

export class OrdsEndpoint {
  private _method?: OrdsHttpMethod
  private _pattern?: string
  private _basePath?: string
  private _params: OrdsParam[] = []
  private _comment?: string
  private _auth?: ServiceAuthorization
  private _responseMediaType?: string
  private _responseStatus?: number
  private _contextUserId?: string
  private _cursorPage?: Required<CursorPageOptions> & CursorQueryMetadata

  cursorPage(options: CursorPageOptions, metadata: CursorQueryMetadata): this {
    const defaultLimit = options.defaultLimit ?? CURSOR_PAGE_DEFAULTS.defaultLimit
    const maxLimit = options.maxLimit ?? CURSOR_PAGE_DEFAULTS.maxLimit
    if (
      !Number.isSafeInteger(defaultLimit) ||
      !Number.isSafeInteger(maxLimit) ||
      defaultLimit < 1 ||
      maxLimit < defaultLimit ||
      maxLimit >= 2147483647
    )
      throw new Error('Cursor page limits must be positive integers with defaultLimit <= maxLimit.')
    const items = this._params.find((p) => p.name === 'items' && p.direction === 'OUT')
    const cursor = this._params.find((p) => p.name === 'cursor' && p.direction === 'IN')
    const limit = this._params.find((p) => p.name === 'limit' && p.direction === 'IN')
    if (
      this.effectiveMethod !== 'GET' ||
      !this.nativeJsonResponse ||
      this.nativeCursorOutputs.length !== 1 ||
      items?.paramType !== 'RESULTSET' ||
      !cursor ||
      !limit ||
      this.paramSourceType(cursor) !== 'URI' ||
      this.paramSourceType(limit) !== 'URI' ||
      limit.odbType !== 'number' ||
      cursor.odbType !== 'json' ||
      !metadata.order.length ||
      cursor.plsqlArg.toUpperCase() !== metadata.cursor.toUpperCase() ||
      limit.plsqlArg.toUpperCase() !== metadata.limit.toUpperCase() ||
      metadata.order.some(
        (column) =>
          !items.resultColumns?.some(
            (item) => item.name === column.name && item.type === column.type && !item.nullable,
          ),
      ) ||
      this._params.some((p) => p.name === 'nextCursor')
    )
      throw new Error(
        'Cursor pages require GET query cursor/limit and typed items from a matching paginated query.',
      )
    this._cursorPage = { ...structuredClone(metadata), defaultLimit, maxLimit }
    return this
  }

  contextUserId(parameter: string): this {
    this._contextUserId = parameter.toUpperCase()
    return this
  }

  auth(policy: ServiceAuthorization): this {
    validateServiceAuthorization(policy)
    this._auth = structuredClone(policy)
    return this
  }

  responseMediaType(value: string): this {
    this._responseMediaType = value
    return this
  }

  responseStatus(value: number): this {
    if (!Number.isInteger(value) || value < 200 || value > 399) {
      throw new Error('responseStatus: status must be an integer from 200 through 399.')
    }
    this._responseStatus = value
    return this
  }

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
    odbType?: OdbType,
    nameOverride?: string,
    sourceTypeOverride?: 'BODY' | 'HEADER' | 'RESPONSE' | 'URI',
  ): this {
    this._params.push(
      new OrdsParam(
        plsqlArg,
        direction,
        type,
        comment,
        resultColumns,
        odbType,
        nameOverride,
        sourceTypeOverride,
      ),
    )
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
    const base = toKebabCase(name)

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

  private get nativeJsonResponse(): boolean {
    const outputs = this._params.filter((p) => this.paramSourceType(p) === 'RESPONSE')
    return (
      (this._responseMediaType === 'application/json' ||
        (this._responseMediaType === undefined &&
          outputs.some((p) => p.paramType === 'RESULTSET'))) &&
      outputs.some((p) => p.odbType === 'json' || p.paramType === 'RESULTSET') &&
      outputs.every(
        (p) =>
          p.direction === 'OUT' &&
          ((p.paramType === 'RESULTSET' &&
            !!p.resultColumns?.length &&
            p.resultColumns.every((column) => column.type !== 'blob')) ||
            (p.odbType !== undefined &&
              ['json', 'clob', 'string', 'guid', 'number'].includes(p.odbType))),
      )
    )
  }

  private nativeOutputName(param: OrdsParam): string | undefined {
    if (!this.nativeJsonResponse || param.direction !== 'OUT') return undefined
    const transport = this.paramSourceType(param)
    return transport === 'RESPONSE' || transport === 'HEADER'
      ? `v_output_${this._params.indexOf(param)}`
      : undefined
  }

  private get nativeCursorOutputs(): OrdsParam[] {
    return this.nativeJsonResponse
      ? this._params.filter(
          (p) => this.paramSourceType(p) === 'RESPONSE' && p.paramType === 'RESULTSET',
        )
      : []
  }

  private cursorJsonStatements(param: OrdsParam): string[] {
    const name = this.nativeOutputName(param)
    const columns = param.resultColumns
    if (!name || !columns?.length) {
      throw new Error('Native cursor JSON serialization requires typed result columns.')
    }
    const values = columns.map((column, index) => {
      const value = `${name}_column_${index}`
      const expression =
        column.type === 'guid'
          ? `RTRIM(${value})`
          : column.type === 'timestamp'
            ? `TO_CHAR(${value}, 'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"')`
            : column.type === 'date'
              ? `TO_CHAR(${value}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
              : column.type === 'boolean'
                ? `CASE ${value} WHEN 1 THEN 'true' WHEN 0 THEN 'false' ELSE 'null' END FORMAT JSON`
                : value
      return `${sqlStr(oracleParameterName(column.name, { stripPrefix: false }))} VALUE ${expression}`
    })
    const keyValues = this._cursorPage?.order.map((key) => {
      const index = columns.findIndex((column) => column.name === key.name)
      const value = `${name}_column_${index}`
      return key.type === 'guid'
        ? `RTRIM(${value})`
        : key.type === 'timestamp'
          ? `TO_CHAR(${value}, 'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"')`
          : key.type === 'date'
            ? `TO_CHAR(${value}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
            : value
    })
    return [
      `LOOP FETCH ${name} INTO ${columns.map((_column, index) => `${name}_column_${index}`).join(', ')};`,
      `EXIT WHEN ${name}%NOTFOUND;`,
      ...(this._cursorPage
        ? [
            `IF ${name}_array.get_size() >= v_page_limit THEN`,
            "IF LENGTHB(v_page_boundary) > 1966 THEN raise_application_error(-20999, 'ODB_HTTP|500|CURSOR_TOO_LARGE'); END IF;",
            "v_page_next_cursor := 'v1.' || v_page_scope || '.' || RAWTOHEX(UTL_I18N.STRING_TO_RAW(v_page_boundary, 'AL32UTF8'));",
            'EXIT;',
            'END IF;',
          ]
        : []),
      `SELECT JSON_OBJECT(${values.join(', ')} NULL ON NULL RETURNING CLOB STRICT) INTO v_json_row FROM dual;`,
      `${name}_array.append(JSON_OBJECT_T.parse(v_json_row));`,
      ...(this._cursorPage
        ? [
            `SELECT JSON_ARRAY(${keyValues?.join(', ')} NULL ON NULL RETURNING VARCHAR2(4000) STRICT) INTO v_page_boundary FROM dual;`,
          ]
        : []),
      'END LOOP;',
      `CLOSE ${name};`,
      `${name}_json := ${name}_array.to_clob();`,
    ]
  }

  private get cursorPageSetup(): string {
    if (!this._cursorPage) return ''
    const cursor = this._params.find((p) => p.name === 'cursor')!
    const limit = this._params.find((p) => p.name === 'limit')!
    const invalidCursor = "raise_application_error(-20999, 'ODB_HTTP|400|CURSOR_INVALID');"
    const invalidLimit = "raise_application_error(-20999, 'ODB_HTTP|400|CURSOR_LIMIT_INVALID');"
    const query = this._params.filter(
      (p) =>
        p.direction === 'IN' &&
        p !== cursor &&
        p !== limit &&
        p.plsqlArg.toUpperCase() !== this._contextUserId,
    )
    const scope = [
      `'endpoint' VALUE ${sqlStr(JSON.stringify([this.module, this.effectivePattern, this.procedureName, this._cursorPage.order]))}`,
      `'subject' VALUE ${this._auth !== undefined && this._auth !== 'anonymous' ? 'v_auth_user_id' : 'NULL'}`,
      ...query.map((p) => `${sqlStr(p.name)} VALUE :${p.bindVariable}`),
    ].join(', ')
    return (
      [
        `BEGIN v_page_limit := NVL(:${limit.bindVariable}, ${this._cursorPage.defaultLimit});`,
        `EXCEPTION WHEN VALUE_ERROR OR INVALID_NUMBER THEN ${invalidLimit} END;`,
        `IF v_page_limit < 1 OR v_page_limit > ${this._cursorPage.maxLimit} OR v_page_limit <> TRUNC(v_page_limit) THEN ${invalidLimit} END IF;`,
        `SELECT LOWER(RAWTOHEX(STANDARD_HASH(JSON_OBJECT(${scope} NULL ON NULL RETURNING VARCHAR2(4000) STRICT), 'SHA256'))) INTO v_page_scope FROM dual;`,
        `BEGIN v_page_token := :${cursor.bindVariable};`,
        `IF v_page_token IS NOT NULL THEN`,
        `IF NOT REGEXP_LIKE(v_page_token, '^v1\\.[0-9a-f]{64}\\.([0-9A-F]{2})+$', 'c') OR SUBSTR(v_page_token, 4, 64) <> v_page_scope THEN ${invalidCursor} END IF;`,
        "v_page_after := UTL_I18N.RAW_TO_CHAR(HEXTORAW(SUBSTR(v_page_token, 69)), 'AL32UTF8');",
        `IF v_page_after IS NULL OR RAWTOHEX(UTL_I18N.STRING_TO_RAW(v_page_after, 'AL32UTF8')) <> SUBSTR(v_page_token, 69) THEN ${invalidCursor} END IF;`,
        `SELECT CASE WHEN v_page_after IS JSON STRICT THEN 1 ELSE 0 END INTO v_page_valid FROM dual;`,
        `IF v_page_valid <> 1 OR NOT REGEXP_LIKE(v_page_after, '^[[:space:]]*\\[') THEN ${invalidCursor} END IF;`,
        'v_page_keys := JSON_ARRAY_T.parse(v_page_after);',
        `IF v_page_keys.get_size() <> ${this._cursorPage.order.length} THEN ${invalidCursor} END IF;`,
        ...this._cursorPage.order.flatMap((key, index) => [
          `v_page_key := v_page_keys.get(${index});`,
          `IF NOT v_page_key.${key.type === 'number' || key.type === 'boolean' ? 'is_number' : 'is_string'}() THEN ${invalidCursor} END IF;`,
          `SELECT ${cursorValueSql('v_page_after', index, key, 'NULL')} INTO v_page_validate_${index} FROM dual;`,
          `IF v_page_validate_${index} IS NULL THEN ${invalidCursor} END IF;`,
          ...(key.type === 'guid'
            ? [
                `IF NOT REGEXP_LIKE(v_page_validate_${index}, '^[0-9A-Fa-f]{32}$', 'c') THEN ${invalidCursor} END IF;`,
              ]
            : []),
          ...(key.type === 'boolean'
            ? [`IF v_page_validate_${index} NOT IN (0, 1) THEN ${invalidCursor} END IF;`]
            : []),
        ]),
        'END IF;',
        `EXCEPTION WHEN VALUE_ERROR THEN ${invalidCursor} END;`,
      ].join(' ') + ' '
    )
  }

  private get handlerSource(): string {
    const binaryBody = this._params.some(
      (param) => this.paramSourceType(param) === 'BODY' && param.odbType === 'blob',
    )
    const args = this._params
      .map((p) =>
        this._cursorPage && p.name === 'cursor'
          ? `${p.plsqlArg.toLowerCase()} => v_page_after`
          : this._cursorPage && p.name === 'limit'
            ? `${p.plsqlArg.toLowerCase()} => v_page_limit`
            : this.nativeOutputName(p)
              ? `${p.plsqlArg.toLowerCase()} => ${this.nativeOutputName(p)}`
              : p.plsqlArg.toUpperCase() === this._contextUserId
                ? `${p.plsqlArg.toLowerCase()} => v_auth_user_id`
                : this.paramSourceType(p) === 'BODY' && p.odbType === 'blob'
                  ? `${p.plsqlArg.toLowerCase()} => v_binary_body`
                  : p.plsqlArg.toUpperCase() === 'P_BODY'
                    ? `${p.plsqlArg.toLowerCase()} => :body`
                    : this.paramSourceType(p) === 'BODY'
                      ? `${p.plsqlArg.toLowerCase()} => ${jsonValueExpression(p)}`
                      : `${p.plsqlArg.toLowerCase()} => :${p.bindVariable}`,
      )
      .join(', ')
    const protectedEndpoint = this._auth !== undefined && this._auth !== 'anonymous'
    const declarations = [
      ...(this._cursorPage
        ? [
            'v_page_limit NUMBER;',
            'v_page_token VARCHAR2(4000);',
            'v_page_scope VARCHAR2(64);',
            'v_page_after VARCHAR2(32767);',
            'v_page_boundary VARCHAR2(32767);',
            'v_page_next_cursor VARCHAR2(4000);',
            'v_page_keys JSON_ARRAY_T;',
            'v_page_key JSON_ELEMENT_T;',
            'v_page_valid NUMBER;',
            ...this._cursorPage.order.map(
              (key, index) =>
                `v_page_validate_${index} ${emitOracleType(key.type, { length: key.length ?? 4000 })};`,
            ),
          ]
        : []),
      ...this._params.flatMap((p) => {
        const name = this.nativeOutputName(p)
        if (!name) return []
        const type =
          this.paramSourceType(p) === 'HEADER'
            ? 'VARCHAR2(32767)'
            : p.paramType === 'RESULTSET'
              ? 'SYS_REFCURSOR'
              : p.odbType === 'json' || p.odbType === 'clob'
                ? 'CLOB'
                : p.odbType === 'number'
                  ? 'NUMBER'
                  : 'VARCHAR2(32767)'
        return [
          `${name} ${type};`,
          ...(p.paramType === 'RESULTSET'
            ? [
                `${name}_array JSON_ARRAY_T := JSON_ARRAY_T();`,
                `${name}_json CLOB;`,
                ...(p.resultColumns ?? []).map(
                  (column, index) =>
                    `${name}_column_${index} ${emitOracleType(column.type, { length: 32767 })};`,
                ),
              ]
            : []),
        ]
      }),
      ...(this.nativeCursorOutputs.length ? ['v_json_row CLOB;'] : []),
      ...(this.nativeJsonResponse
        ? [
            'v_json_response CLOB;',
            'v_json_chunk VARCHAR2(32767);',
            'v_json_offset PLS_INTEGER := 1;',
            'v_json_amount PLS_INTEGER;',
          ]
        : []),
      ...(binaryBody ? ['v_binary_body BLOB := :body;'] : []),
      ...(this._params.some(
        (param) => this.paramSourceType(param) === 'BODY' && param.odbType !== 'blob',
      )
        ? ['v_body CLOB := :body_text;']
        : []),
      ...(this._params.some(
        (param) => this.paramSourceType(param) === 'BODY' && param.odbType === 'clob',
      )
        ? ['v_body_json JSON_OBJECT_T := JSON_OBJECT_T.parse(v_body);']
        : []),
      ...(protectedEndpoint ? ['v_auth_user_id VARCHAR2(32);'] : []),
    ]
    const declaration = declarations.length ? `DECLARE ${declarations.join(' ')} ` : ''
    const authorization = protectedEndpoint
      ? `v_auth_user_id := odb_auth.require_user(${odbHttp.bearerToken(':odb_authorization').toSQL()}); `
      : ''
    const policy = this._auth
    const checks =
      typeof policy === 'object'
        ? [
            ...(policy.roles ?? []).map(
              (role) => `odb_auth.has_role(v_auth_user_id, ${sqlStr(role)})`,
            ),
            ...(policy.permissions ?? []).map(
              (permission) => `odb_auth.has_permission(v_auth_user_id, ${sqlStr(permission)})`,
            ),
          ]
        : []
    const enforcement = checks.length
      ? `IF NOT (${checks.join(policy && typeof policy === 'object' && policy.match === 'any' ? ' OR ' : ' AND ')}) THEN raise_application_error(${ODB_ERROR_NUMBER}, 'ODB_ERROR|FORBIDDEN|FORBIDDEN'); END IF; `
      : ''
    const normalizeBody = binaryBody
      ? 'IF v_binary_body IS NULL THEN DBMS_LOB.CREATETEMPORARY(v_binary_body, TRUE, DBMS_LOB.CALL); END IF; '
      : ''
    const jsonResponse = this.nativeJsonResponse
      ? [
          ...this.nativeCursorOutputs.flatMap((p) => this.cursorJsonStatements(p)),
          // ASCII escaping avoids HTP buffer overflows on large multibyte JSON strings.
          `SELECT JSON_SERIALIZE(JSON_OBJECT(${this._params
            .filter((p) => this.paramSourceType(p) === 'RESPONSE')
            .map(
              (p) =>
                `${sqlStr(p.name)} VALUE ${p.paramType === 'RESULTSET' ? `${this.nativeOutputName(p)}_json` : p.odbType === 'guid' ? `RTRIM(${this.nativeOutputName(p)})` : this.nativeOutputName(p)}${p.odbType === 'json' || p.paramType === 'RESULTSET' ? ' FORMAT JSON' : ''}`,
            )
            .join(
              ', ',
            )}${this._cursorPage ? ", 'nextCursor' VALUE v_page_next_cursor ABSENT ON NULL" : ''} RETURNING CLOB STRICT) RETURNING CLOB ASCII) INTO v_json_response FROM dual;`,
          "owa_util.mime_header('application/json', FALSE);",
          ...this._params
            .filter((p) => p.direction === 'OUT' && this.paramSourceType(p) === 'HEADER')
            .map(
              (p) =>
                `IF ${this.nativeOutputName(p)} IS NOT NULL THEN htp.p(${sqlStr(`${p.name}: `)} || ${this.nativeOutputName(p)}); END IF;`,
            ),
          'owa_util.http_header_close;',
          'WHILE v_json_offset <= DBMS_LOB.GETLENGTH(v_json_response) LOOP',
          'v_json_amount := 8000;',
          'DBMS_LOB.READ(v_json_response, v_json_amount, v_json_offset, v_json_chunk);',
          'htp.prn(v_json_chunk);',
          'v_json_offset := v_json_offset + v_json_amount;',
          'END LOOP;',
        ].join(' ')
      : ''
    const call = `${normalizeBody}${this.cursorPageSetup}${this.packageName.toLowerCase()}.${this.procedureName.toLowerCase()}(${args});${this._responseStatus === undefined ? '' : ` :status_code := ${this._responseStatus};`}${jsonResponse ? ` ${jsonResponse}` : ''}`
    const envelope = "'ODB_HTTP\\|([4-5][0-9]{2})\\|([A-Z][A-Z0-9_]{0,99})'"
    const status = `REGEXP_SUBSTR(SQLERRM, ${envelope}, 1, 1, NULL, 1)`
    const code = `REGEXP_SUBSTR(SQLERRM, ${envelope}, 1, 1, NULL, 2)`
    const explicitResponse = [
      `:status_code := TO_NUMBER(${status});`,
      "owa_util.mime_header('application/json', FALSE);",
      'owa_util.http_header_close;',
      `htp.p(JSON_OBJECT('code' VALUE ${code}));`,
    ].join(' ')
    const odbEnvelope = "'ODB_ERROR\\|([A-Z][A-Z0-9_]{0,99})\\|([A-Z][A-Z0-9_]{0,99})'"
    const odbKind = `REGEXP_SUBSTR(SQLERRM, ${odbEnvelope}, 1, 1, NULL, 1)`
    const odbCode = `REGEXP_SUBSTR(SQLERRM, ${odbEnvelope}, 1, 1, NULL, 2)`
    const odbStatus = Object.entries(ODB_ERROR_STATUS)
      .map(([kind, httpStatus]) => `WHEN '${kind}' THEN ${httpStatus}`)
      .join(' ')
    const odbErrorResponse = [
      `:status_code := CASE ${odbKind} ${odbStatus} ELSE 500 END;`,
      "owa_util.mime_header('application/json', FALSE);",
      'owa_util.http_header_close;',
      `htp.p(JSON_OBJECT('code' VALUE ${odbCode}));`,
    ].join(' ')
    const fallbackResponse = [
      ':status_code := 500;',
      "owa_util.mime_header('application/json', FALSE);",
      'owa_util.http_header_close;',
      `htp.p('{"code":"INTERNAL_SERVER_ERROR"}');`,
    ].join(' ')
    const closeCursors = this.nativeCursorOutputs
      .map((p) => {
        const name = this.nativeOutputName(p)
        return `IF ${name}%ISOPEN THEN CLOSE ${name}; END IF;`
      })
      .join(' ')
    return `${declaration}BEGIN ${authorization}${enforcement}${call} EXCEPTION WHEN OTHERS THEN ${closeCursors ? `${closeCursors} ` : ''}IF SQLCODE = -20999 THEN ${explicitResponse} ELSIF SQLCODE = ${ODB_ERROR_NUMBER} THEN ${odbErrorResponse} ELSE ${fallbackResponse} END IF; END;`
  }

  private paramSourceType(param: OrdsParam): OrdsParamNode['sourceType'] {
    if (param.hasSourceTypeOverride) {
      return param.sourceType
    }
    if (param.direction === 'OUT') return 'RESPONSE'
    const pathParams = new Set(
      [...this.effectivePattern.matchAll(/:([a-zA-Z0-9_-]+)\??/g)].map((match) => match[1]),
    )
    if (pathParams.has(param.name)) return 'URI'
    return this.effectiveMethod === 'POST' || this.effectiveMethod === 'PUT' ? 'BODY' : 'HEADER'
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
      params: this._params
        .filter((p) => p.plsqlArg.toUpperCase() !== this._contextUserId)
        .map((p) => {
          const node = p.toNode(this.paramSourceType(p))
          return this._cursorPage && p.name === 'cursor'
            ? { ...node, odbType: 'string' as const }
            : node
        }),
      auth: this._auth,
      responseMediaType: this._responseMediaType,
      responseStatus: this._responseStatus,
      ...(this._cursorPage ? { cursorPage: { ...this._cursorPage } } : {}),
      comment: this._comment,
    }
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
    const templateSql =
      options.defineTemplate === false
        ? []
        : [
            `  ords.define_template(`,
            `    p_module_name => '${this.module}',`,
            `    p_pattern     => '${pattern}',`,
            `    p_comments    => ${comment}`,
            `  );`,
            `  COMMIT;`,
            '',
          ]
    const body = [
      ...moduleSql,
      ...templateSql,
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
      ...(this._auth !== undefined && this._auth !== 'anonymous'
        ? [
            `  ords.define_parameter(p_module_name => '${this.module}', p_pattern => '${pattern}', p_method => '${method}', p_name => 'Authorization', p_bind_variable_name => 'odb_authorization', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');`,
          ]
        : []),
      ...this._params.flatMap((p) => {
        if (p.plsqlArg.toUpperCase() === this._contextUserId) return []
        if (this.nativeOutputName(p)) return []
        if (p.plsqlArg.toUpperCase() === 'P_BODY' || this.paramSourceType(p) === 'BODY') return []
        return [
          '',
          `  ords.define_parameter(`,
          `    p_module_name        => '${this.module}',`,
          `    p_pattern            => '${pattern}',`,
          `    p_method             => '${method}',`,
          `    p_name               => '${p.name}',`,
          `    p_bind_variable_name => '${p.bindVariable}',`,
          `    p_source_type        => '${this.paramSourceType(p)}',`,
          `    p_param_type         => '${this._cursorPage && p.name === 'limit' ? 'STRING' : p.paramType}',`,
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

function jsonValueExpression(param: OrdsParam): string {
  const path = `$.${param.name}`
  if (param.odbType === 'json') {
    return `JSON_QUERY(v_body, '${path}' RETURNING CLOB)`
  }
  if (param.odbType === 'clob') {
    return `v_body_json.get_clob(${sqlStr(param.name)})`
  }
  if (param.paramType === 'BOOLEAN') {
    return `CASE JSON_VALUE(v_body, '${path}' RETURNING VARCHAR2(5)) WHEN 'true' THEN TRUE WHEN 'false' THEN FALSE END`
  }
  return `JSON_VALUE(v_body, '${path}' RETURNING ${jsonValueType(param.paramType)})`
}

function jsonValueType(paramType: OrdsParamType): string {
  switch (paramType) {
    case 'INT':
    case 'LONG':
    case 'DOUBLE':
      return 'NUMBER'
    case 'TIMESTAMP':
      return 'TIMESTAMP'
    default:
      return 'VARCHAR2(32767)'
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
