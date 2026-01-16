// JSON Export format types (aligned with test.json)
export type ColumnInfo = {
  name: string
  type: string
  default: string | null
  nullable: boolean
  identity: boolean
}

export type TableInfo = {
  name: string
  columns: ColumnInfo[]
  primary_key: string[]
  unique?: string[][]
  indexes?: string[][] | null
  foreignKeys?: Array<{
    name: string
    column: string
    referenceTable: string
    referenceColumn: string
  }> | null
}

export type SchemaExport = {
  schema: string
  exported: string
  tables: TableInfo[]
}

// Internal column definition for builder
type InternalColumnDef = {
  name: string
  type: string
  default: string | null
  nullable: boolean
  identity: boolean
  unique?: boolean
}

// Internal table definition
type TableDefinition = {
  name: string
  comment: string
  primaryKey?: string[] | string
  columns: Map<string, InternalColumnDef>
  unique?: string[][]
  indexes?: string[][]
  foreignKeys?: Array<{
    column: string
    referenceTable: string
    referenceColumn: string
  }>
}

export class Table {
  private definition: TableDefinition = {
    name: '',
    comment: '',
    columns: new Map(),
  }

  constructor() {}

  create(name: string, comment: string): this {
    this.definition.name = name
    this.definition.comment = comment
    this.definition.columns = new Map()
    return this
  }

  addColumn(
    name: string,
    type: string,
    defaultValue: string | null = null,
    nullable: boolean = true,
    identity: boolean = false,
    unique: boolean = false,
  ): this {
    this.definition.columns.set(name.toLowerCase(), {
      name,
      type,
      default: defaultValue,
      nullable,
      identity,
      unique,
    })
    return this
  }

  primaryKey(columns: string[] | string): this {
    this.definition.primaryKey = columns
    return this
  }

  addUnique(columns: string[]): this {
    if (!this.definition.unique) {
      this.definition.unique = []
    }
    this.definition.unique.push(columns)
    return this
  }

  addIndex(columns: string[]): this {
    if (!this.definition.indexes) {
      this.definition.indexes = []
    }
    this.definition.indexes.push(columns)
    return this
  }

  addIndexes(indexes: string[][]): this {
    this.definition.indexes = indexes
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

  /**
   * Convert table definition to JSON export format (TableInfo)
   */
  toTableInfo(): TableInfo {
    this.validate()

    const columns: ColumnInfo[] = Array.from(this.definition.columns.values()).map((col) => ({
      name: col.name.toUpperCase(),
      type: col.type,
      default: col.default,
      nullable: col.nullable,
      identity: col.identity,
    }))

    const tableInfo: TableInfo = {
      name: this.definition.name.toUpperCase(),
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
      uniqueConstraints.push(...this.definition.unique)
    }
    // From column unique flag
    for (const col of this.definition.columns.values()) {
      if (col.unique) {
        uniqueConstraints.push([col.name.toUpperCase()])
      }
    }
    if (uniqueConstraints.length > 0) {
      tableInfo.unique = uniqueConstraints
    }

    // Add indexes
    if (this.definition.indexes) {
      tableInfo.indexes = this.definition.indexes.map((idx) => idx.map((col) => col.toUpperCase()))
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

  render(): string {
    return JSON.stringify(this.toTableInfo(), null, 2)
  }
}
