// SQL Statement type for toSql() output
export type SqlStatement = {
  type: 'table' | 'index' | 'comment' | 'constraint'
  name: string
  sql: string
}

// JSON Export format types (aligned with test.json)
export type ColumnInfo = {
  name: string
  description?: string
  type: string
  default: string | null
  required: boolean
  identity: boolean
}

export type TableInfo = {
  name: string
  description?: string
  columns: ColumnInfo[]
  primary_key: string[]
  unique?: string[][]
  indexes?: string[][] | null
  checks?: Array<{
    column: string
    values: string[]
  }> | null
  foreignKeys?: Array<{
    name: string
    column: string
    referenceTable: string
    referenceColumn: string
  }> | null
}

// Predefined attribute types for strict type safety
export type AttributeType =
  | 'id'
  | 'guid'
  | 'char'
  | 'string30'
  | 'string200'
  | 'string2000'
  | 'text'
  | 'digit'
  | 'number'
  | 'integer'
  | 'currency'
  | 'now'
  | 'date'
  | 'timestamp'
  | 'binary'

// Type resolution map with SQL type + metadata (required controlled per table)
const COLUMN_TYPE_SPECS: Record<
  AttributeType,
  { type: string; default?: string; identity?: boolean; required?: boolean }
> = {
  id: { type: 'NUMBER(19,0)', identity: true, required: true },
  guid: { type: 'RAW(16)', default: 'SYS_GUID() ', required: true },
  char: { type: 'CHAR(1 CHAR)' },
  string30: { type: 'VARCHAR2(30 CHAR)' },
  string200: { type: 'VARCHAR2(200 CHAR)' },
  string2000: { type: 'VARCHAR2(2000 CHAR)' },
  text: { type: 'CLOB' },
  digit: { type: 'NUMBER(1,0)' },
  number: { type: 'NUMBER(38,16)' },
  integer: { type: 'NUMBER(19,0)' },
  currency: { type: 'NUMBER(19,4)' },
  now: { type: 'TIMESTAMP(6)', default: 'SYSTIMESTAMP', required: true },
  date: { type: 'DATE' },
  timestamp: { type: 'TIMESTAMP(6)' },
  binary: { type: 'BLOB' },
}

// Attribute options for addAttribute method
export type AttributeOptions = {
  description?: string
  default?: string | null
  required?: boolean
  identity?: boolean
}

// Internal column definition for builder
type InternalColumnDef = {
  name: string
  description?: string
  type: string
  default: string | null
  required: boolean
  identity: boolean
}

// Entity constructor options
export type EntityOptions = {
  description?: string
}

// Internal table definition
type TableDefinition = {
  name: string
  description?: string
  comment: string
  primaryKey?: string[] | string
  columns: Map<string, InternalColumnDef>
  unique?: string[][]
  indexes?: string[][]
  checks?: Array<{
    column: string
    values: string[]
  }>
  foreignKeys?: Array<{
    column: string
    referenceTable: string
    referenceColumn: string
  }>
}

export class Entity {
  private definition: TableDefinition = {
    name: '',
    comment: '',
    columns: new Map(),
  }

  private resolveColumnType(type: AttributeType): {
    type: string
    default?: string
    required?: boolean
    identity?: boolean
  } {
    const spec = COLUMN_TYPE_SPECS[type]
    return spec
  }

  constructor(name: string, options?: EntityOptions) {
    this.definition.name = name
    this.definition.description = options?.description
    this.definition.columns = new Map()
  }

  create(name: string, comment: string): this {
    this.definition.name = name
    this.definition.comment = comment
    this.definition.columns = new Map()
    return this
  }

  addAttribute(name: string, type: AttributeType, options?: Partial<AttributeOptions>): this {
    const resolved = this.resolveColumnType(type)
    const {
      description,
      default: defaultValue = resolved.default ?? null,
      required = resolved.required ?? false,
      identity = resolved.identity ?? false,
    } = options ?? {}
    this.definition.columns.set(name.toLowerCase(), {
      name,
      description,
      type: resolved.type,
      default: defaultValue,
      required,
      identity,
    })
    return this
  }

  primaryKey(columns: string[] | string): this {
    this.definition.primaryKey = columns
    return this
  }

  unique(columns: string | string[] | string[][]): this {
    if (!this.definition.unique) {
      this.definition.unique = []
    }
    if (typeof columns === 'string') {
      // Single column: 'col' -> [['col']]
      this.definition.unique.push([columns])
    } else if (Array.isArray(columns) && columns.length > 0 && typeof columns[0] === 'string') {
      // Array of columns (composite unique): ['col1', 'col2'] -> [['col1', 'col2']]
      this.definition.unique.push(columns as string[])
    } else if (Array.isArray(columns)) {
      // Array of arrays: [['col1'], ['col2', 'col3']] -> as is
      this.definition.unique.push(...(columns as string[][]))
    }
    return this
  }

  addUnique(columns: string[]): this {
    return this.unique(columns)
  }

  indexes(...columns: (string | string[] | string[][])[]): this {
    if (!this.definition.indexes) {
      this.definition.indexes = []
    }
    for (const col of columns) {
      if (typeof col === 'string') {
        // Single column: 'col' -> [['col']]
        this.definition.indexes.push([col])
      } else if (Array.isArray(col) && col.length > 0 && typeof col[0] === 'string') {
        // Array of columns (composite index): ['col1', 'col2'] -> [['col1', 'col2']]
        this.definition.indexes.push(col as string[])
      } else if (Array.isArray(col)) {
        // Array of arrays: [['col1'], ['col2', 'col3']] -> as is
        this.definition.indexes.push(...(col as string[][]))
      }
    }
    return this
  }

  addIndex(columns: string[]): this {
    return this.indexes(columns)
  }

  addIndexes(indexes: string[][]): this {
    return this.indexes(indexes)
  }

  check(column: string, values: string[]): this {
    if (!this.definition.checks) {
      this.definition.checks = []
    }
    this.definition.checks.push({ column, values })
    return this
  }

  addForeignKey(column: string, referenceTable: string, referenceColumn: string): this {
    if (!this.definition.foreignKeys) {
      this.definition.foreignKeys = []
    }
    this.definition.foreignKeys.push({
      column,
      referenceTable,
      referenceColumn,
    })
    return this
  }

  validate(): boolean {
    // table name less than 30 characters
    if (this.definition.name.length > 30) {
      throw new Error(`Table name ${this.definition.name} exceeds 30 characters`)
    }

    // column names less than 30 characters
    for (const [colName] of this.definition.columns) {
      if (colName.length > 30) {
        throw new Error(`Column name ${colName} exceeds 30 characters`)
      }
    }

    // primaryKey exists in columns
    if (this.definition.primaryKey) {
      const pkCols = Array.isArray(this.definition.primaryKey)
        ? this.definition.primaryKey
        : [this.definition.primaryKey]
      for (const pkCol of pkCols) {
        if (!this.definition.columns.has(pkCol.toLowerCase())) {
          throw new Error(`Primary key column ${pkCol} does not exist in table`)
        }
      }
    }

    // validate table-level indexes
    if (this.definition.indexes) {
      for (const indexCols of this.definition.indexes) {
        for (const col of indexCols) {
          if (!this.definition.columns.has(col.toLowerCase())) {
            throw new Error(`Index column ${col} does not exist in table`)
          }
        }
      }
    }

    return true
  }

  toTableInfo(): TableInfo {
    this.validate()

    const columns: ColumnInfo[] = Array.from(this.definition.columns.values()).map((col) => ({
      name: col.name.toUpperCase(),
      ...(col.description && { description: col.description }),
      type: col.type,
      default: col.default,
      required: col.required,
      identity: col.identity,
    }))

    const tableInfo: TableInfo = {
      name: this.definition.name.toUpperCase(),
      ...(this.definition.description && { description: this.definition.description }),
      columns,
      primary_key: this.definition.primaryKey
        ? Array.isArray(this.definition.primaryKey)
          ? this.definition.primaryKey.map((p) => p.toUpperCase())
          : [this.definition.primaryKey.toUpperCase()]
        : [],
    }

    // Add unique constraints
    const uniqueConstraints: string[][] = []
    if (this.definition.unique) {
      uniqueConstraints.push(
        ...this.definition.unique.map((cols) => cols.map((c) => c.toUpperCase())),
      )
    }
    if (uniqueConstraints.length > 0) {
      tableInfo.unique = uniqueConstraints
    }

    // Add indexes
    if (this.definition.indexes) {
      tableInfo.indexes = this.definition.indexes.map((idx) => idx.map((col) => col.toUpperCase()))
    }

    // Add check constraints
    if (this.definition.checks) {
      tableInfo.checks = this.definition.checks.map((chk) => ({
        column: chk.column.toUpperCase(),
        values: chk.values,
      }))
    }

    // Add foreign keys
    if (this.definition.foreignKeys) {
      tableInfo.foreignKeys = this.definition.foreignKeys.map((fk) => ({
        name: `fk_${this.definition.name}_${fk.column}`,
        column: fk.column.toUpperCase(),
        referenceTable: fk.referenceTable.toUpperCase(),
        referenceColumn: fk.referenceColumn.toUpperCase(),
      }))
    }

    return tableInfo
  }

  toJson(): string {
    return JSON.stringify(this.toTableInfo(), null, 2)
  }

  toObject(): TableInfo {
    return this.toTableInfo()
  }

  /**
   * Generate SQL statements for table creation
   * Returns array of statements: table, indexes, comments, constraints
   */
  toSql(): SqlStatement[] {
    this.validate()
    const statements: SqlStatement[] = []
    const tableName = this.definition.name.toUpperCase()

    // 1. CREATE TABLE statement
    const columnDefs: string[] = []
    for (const col of this.definition.columns.values()) {
      let colDef = `  ${col.name.toUpperCase()} ${col.type}`
      if (col.default) {
        // Check if default needs quotes (for CHAR, VARCHAR2, CLOB types)
        const isStringType = /^(CHAR|VARCHAR2|CLOB)/i.test(col.type)
        const defaultValue = col.default.trim()
        // Don't quote if already a function call (contains parentheses) or already quoted
        const needsQuotes =
          isStringType && !defaultValue.includes('(') && !defaultValue.startsWith("'")
        colDef += ` DEFAULT ${needsQuotes ? `'${defaultValue}'` : defaultValue}`
      }
      if (col.required) {
        colDef += ' NOT NULL'
      }
      if (col.identity) {
        colDef += ' GENERATED BY DEFAULT AS IDENTITY'
      }
      columnDefs.push(colDef)
    }

    // Add primary key constraint inline
    if (this.definition.primaryKey) {
      const pkCols = Array.isArray(this.definition.primaryKey)
        ? this.definition.primaryKey
        : [this.definition.primaryKey]
      const pkName = `pk_${this.definition.name}`.toLowerCase()
      columnDefs.push(
        `  CONSTRAINT ${pkName} PRIMARY KEY (${pkCols.map((c) => c.toUpperCase()).join(', ')})`,
      )
    }

    statements.push({
      type: 'table',
      name: tableName.toLowerCase(),
      sql: `CREATE TABLE ${tableName} (\n${columnDefs.join(',\n')}\n);`,
    })

    // 2. Table comment
    if (this.definition.description) {
      statements.push({
        type: 'comment',
        name: `${tableName.toLowerCase()}_table`,
        sql: `COMMENT ON TABLE ${tableName} IS '${this.definition.description.replace(/'/g, "''")}';`,
      })
    }

    // 3. Column comments
    for (const col of this.definition.columns.values()) {
      if (col.description) {
        statements.push({
          type: 'comment',
          name: `${tableName.toLowerCase()}_${col.name.toLowerCase()}`,
          sql: `COMMENT ON COLUMN ${tableName}.${col.name.toUpperCase()} IS '${col.description.replace(/'/g, "''")}';`,
        })
      }
    }

    // 4. Unique constraints
    if (this.definition.unique) {
      this.definition.unique.forEach((cols) => {
        const ukName = `uk_${this.definition.name}_${cols.join('_')}`.toLowerCase()
        statements.push({
          type: 'constraint',
          name: ukName,
          sql: `ALTER TABLE ${tableName} ADD CONSTRAINT ${ukName} UNIQUE (${cols.map((c) => c.toUpperCase()).join(', ')});`,
        })
      })
    }

    // 5. Check constraints
    if (this.definition.checks) {
      this.definition.checks.forEach((chk) => {
        const ckName = `ck_${this.definition.name}_${chk.column}`.toLowerCase()
        const values = chk.values.map((v) => `'${v}'`).join(', ')
        statements.push({
          type: 'constraint',
          name: ckName,
          sql: `ALTER TABLE ${tableName} ADD CONSTRAINT ${ckName} CHECK (${chk.column.toUpperCase()} IN (${values}));`,
        })
      })
    }

    // 6. Foreign key constraints
    if (this.definition.foreignKeys) {
      this.definition.foreignKeys.forEach((fk) => {
        const fkName = `fk_${this.definition.name}_${fk.column}`.toLowerCase()
        statements.push({
          type: 'constraint',
          name: fkName,
          sql: `ALTER TABLE ${tableName} ADD CONSTRAINT ${fkName} FOREIGN KEY (${fk.column.toUpperCase()}) REFERENCES ${fk.referenceTable.toUpperCase()}(${fk.referenceColumn.toUpperCase()});`,
        })
      })
    }

    // 7. Indexes
    if (this.definition.indexes) {
      this.definition.indexes.forEach((cols) => {
        const idxName = `idx_${this.definition.name}_${cols.join('_')}`.toLowerCase()
        statements.push({
          type: 'index',
          name: idxName,
          sql: `CREATE INDEX ${idxName} ON ${tableName} (${cols.map((c) => c.toUpperCase()).join(', ')});`,
        })
      })
    }

    return statements
  }
}
