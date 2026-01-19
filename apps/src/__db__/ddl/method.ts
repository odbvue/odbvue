import { Query } from '../dml/query.js'

export type MethodParamType =
  | 'string'
  | 'integer'
  | 'number'
  | 'datetime'
  | 'text'
  | 'binary'
  | 'object'

export type MethodParams = {
  [name: string]: MethodParamType
}

export type MethodReturnType = 'query' | 'void' | 'string' | 'integer' | 'number'

export type MethodInfo = {
  name: string
  packageName: string
  parameters: MethodParams
  returnType: MethodReturnType
  query?: Query
  selectColumns?: string[]
  fromTable?: string
  comment?: string
  requiredRoles: string[]
}

const ParamTypeMapping: Record<MethodParamType, string> = {
  string: 'VARCHAR2',
  integer: 'PLS_INTEGER',
  number: 'NUMBER',
  datetime: 'TIMESTAMP',
  text: 'CLOB',
  binary: 'BLOB',
  object: 'SYS_REFCURSOR',
}

export class Method {
  private info: MethodInfo

  constructor(name?: string) {
    this.info = {
      name: name || '',
      packageName: '',
      parameters: {},
      returnType: 'void',
      requiredRoles: [],
    }
  }

  /**
   * Set the package name for this method
   */
  package(packageName: string): this {
    this.info.packageName = packageName
    return this
  }

  /**
   * Set the method name
   */
  name(name: string): this {
    this.info.name = name
    return this
  }

  /**
   * Set method parameters
   */
  params(parameters: MethodParams): this {
    this.info.parameters = parameters
    return this
  }

  /**
   * Add a single parameter
   */
  addParam(name: string, type: MethodParamType): this {
    this.info.parameters[name] = type
    return this
  }

  /**
   * Set return type to query (returns a cursor)
   */
  returnQuery(): this {
    this.info.returnType = 'query'
    return this
  }

  /**
   * Set return type to void (no return)
   */
  returnVoid(): this {
    this.info.returnType = 'void'
    return this
  }

  /**
   * Set columns to select
   */
  select(columns: string[]): this {
    this.info.selectColumns = columns
    return this
  }

  /**
   * Set the table to query from
   */
  from(tableName: string): this {
    this.info.fromTable = tableName
    return this
  }

  /**
   * Set a custom query object
   */
  query(query: Query): this {
    this.info.query = query
    return this
  }

  /**
   * Set comment for the method
   */
  comment(comment: string): this {
    this.info.comment = comment
    return this
  }

  /**
   * Set required role(s) for this method
   * @param roles - A single role string or array of role strings
   */
  requiresRole(roles: string | string[]): this {
    this.info.requiredRoles = Array.isArray(roles) ? roles : [roles]
    return this
  }

  /**
   * Get the method info
   */
  toMethodInfo(): MethodInfo {
    // Auto-generate name from method definition if not set
    if (!this.info.name && this.info.fromTable) {
      // Generate name like get_<table_name>
      this.info.name = `get_${this.info.fromTable.toLowerCase()}`
    }
    return { ...this.info }
  }

  /**
   * Get package name
   */
  getPackageName(): string {
    return this.info.packageName
  }

  /**
   * Build the Query object from select/from definition
   */
  buildQuery(): Query {
    if (this.info.query) {
      return this.info.query
    }

    const query = new Query()

    if (this.info.selectColumns && this.info.selectColumns.length > 0) {
      // Use the select() method with array of columns
      query.select(this.info.selectColumns)
    }

    if (this.info.fromTable) {
      query.from(this.info.fromTable)
    }

    return query
  }

  /**
   * Render the procedure spec for this method
   */
  renderSpec(): string {
    const methodName = this.info.name || `get_${this.info.fromTable?.toLowerCase() || 'data'}`
    const comment = this.info.comment || `Get ${this.info.fromTable || 'data'}`

    let sql = `  PROCEDURE ${methodName}( -- ${comment}\n`

    // Add parameters
    const paramEntries = Object.entries(this.info.parameters)
    const allParams: string[] = []

    for (const [name, type] of paramEntries) {
      const plsqlType = ParamTypeMapping[type] || 'VARCHAR2'
      let paramStr = `    p_${name} IN ${plsqlType} DEFAULT NULL`
      if (
        paramEntries.indexOf([name, type]) < paramEntries.length - 1 ||
        this.info.returnType === 'query'
      ) {
        paramStr += `,`
      }
      paramStr += ` -- ${name} parameter`
      allParams.push(paramStr)
    }

    // Add result cursor for query return type
    if (this.info.returnType === 'query') {
      allParams.push(`    r_result OUT SYS_REFCURSOR -- Result cursor`)
    }

    sql += allParams.join('\n')
    sql += `\n  );\n\n`
    return sql
  }

  /**
   * Render the procedure body for this method
   */
  renderBody(): string {
    const methodName = this.info.name || `get_${this.info.fromTable?.toLowerCase() || 'data'}`

    let sql = `  PROCEDURE ${methodName}(`

    // Add parameters
    const paramEntries = Object.entries(this.info.parameters)
    const allParams: string[] = []

    for (const [name, type] of paramEntries) {
      const plsqlType = ParamTypeMapping[type] || 'VARCHAR2'
      let paramStr = `    p_${name} IN ${plsqlType} DEFAULT NULL`
      if (
        paramEntries.indexOf([name, type]) < paramEntries.length - 1 ||
        this.info.returnType === 'query'
      ) {
        paramStr += `,`
      }
      allParams.push(paramStr)
    }

    // Add result cursor for query return type
    if (this.info.returnType === 'query') {
      allParams.push(`    r_result OUT SYS_REFCURSOR`)
    }

    if (allParams.length > 0) {
      sql += `\n`
      sql += allParams.join('\n')
    }

    sql += `\n  ) IS\n  BEGIN\n`

    // Add role check if required roles are specified
    if (this.info.requiredRoles && this.info.requiredRoles.length > 0) {
      const rolesStr = this.info.requiredRoles.map((r) => `'${r}'`).join(', ')
      sql += `    IF pck_api_auth.role(NULL, ${rolesStr}) IS NULL THEN\n`
      sql += `      pck_api_auth.http_401;\n`
      sql += `      RETURN;\n`
      sql += `    END IF;\n\n`
    }

    // Generate body based on return type
    if (this.info.returnType === 'query') {
      const query = this.buildQuery()
      const queryStr = query.build()
      sql += `    OPEN r_result FOR\n`
      const queryLines = queryStr.split('\n')
      sql += queryLines.map((line: string) => `      ${line}`).join('\n')
      sql += `;\n`
    }

    sql += `  END ${methodName};\n\n`
    return sql
  }
}
