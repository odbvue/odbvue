type BaseColumnType = {
  notNullable?: boolean
  comment: string
  check?: string | string[]
  reference?: ReferenceConstraint
  unique?: boolean
  indexed?: boolean
}

type NumberColumnType = BaseColumnType & {
  type: 'number'
  precision: number
  scale?: number
  default?: number
  identity?: boolean
}

type StringColumnType = BaseColumnType & {
  type: 'string'
  length: number
  default?: string
}

type IntegerColumnType = BaseColumnType & {
  type: 'integer'
  default?: number
}

type TextColumnType = BaseColumnType & {
  type: 'text'
  default?: string
}

type BinaryColumnType = BaseColumnType & {
  type: 'binary'
}

type CharColumnType = BaseColumnType & {
  type: 'symbol'
  length: number
  default?: string
}

type DateTimeColumnType = BaseColumnType & {
  type: 'datetime'
  default?: string | boolean
}

type GuidColumnType = BaseColumnType & {
  type: 'guid'
  default: string | boolean
}

type JsonColumnType = BaseColumnType & {
  type: 'json'
  default?: string
}

export type ColumnType =
  | NumberColumnType
  | StringColumnType
  | IntegerColumnType
  | TextColumnType
  | BinaryColumnType
  | CharColumnType
  | DateTimeColumnType
  | GuidColumnType
  | JsonColumnType

type ReferenceConstraint = {
  table: string
  column: string
}

type ConstraintInfo = {
  name: string
  type: string
  definition: string
}

type ColumnInfo = {
  type: ColumnType
  comment: string
  check?: string | string[]
  reference?: ReferenceConstraint
  unique?: boolean
  indexed?: boolean
  notNullable?: boolean
}

export type TableInfo = {
  name: string
  primaryKey?: string[] | string
  columns: Record<string, ColumnInfo>
  indexes?: string[][]
  constraints?: ConstraintInfo[]
  comment: string
}

// Common column type presets
export const string32: ColumnType = {
  type: 'string',
  length: 32,
  comment: '',
}

export const string200: ColumnType = {
  type: 'string',
  length: 200,
  comment: '',
}

export const string2000: ColumnType = {
  type: 'string',
  length: 2000,
  comment: '',
}

export const symbol: ColumnType = {
  type: 'symbol',
  length: 1,
  comment: '',
}

export const char32: ColumnType = {
  type: 'symbol',
  length: 32,
  comment: '',
}

export const numberIdentity: ColumnType = {
  type: 'number',
  precision: 19,
  scale: 0,
  identity: true,
  comment: '',
}

export const timestampAudit: ColumnType = {
  type: 'datetime',
  default: true,
  comment: '',
}

export const jsonData: ColumnType = {
  type: 'json',
  comment: '',
}

export const guidDefault: ColumnType = {
  type: 'guid',
  default: true,
  comment: '',
}

export const colType = {
  string32,
  string200,
  string2000,
  symbol,
  char32,
  numberIdentity,
  timestampAudit,
  jsonData,
  guidDefault,
}

export const columnType = colType

export class Column {
  private info: ColumnInfo

  constructor(
    private table: Table,
    private name: string,
    type: ColumnType,
    comment: string,
  ) {
    this.info = { type, comment }
    this.table.info.columns[name] = this.info
  }

  notNullable(): this {
    this.info.notNullable = true
    return this
  }

  unique(): this {
    this.info.unique = true
    return this
  }

  indexed(): this {
    this.info.indexed = true
    return this
  }

  check(condition: string | string[]): this {
    this.info.check = condition
    return this
  }

  reference(table: string, column: string): this {
    this.info.reference = { table, column }
    return this
  }

  col(name: string, type: ColumnType, comment: string): Column {
    return new Column(this.table, name, type, comment)
  }

  colString32(name: string, comment: string): Column {
    return this.col(name, string32, comment)
  }

  colString200(name: string, comment: string): Column {
    return this.col(name, string200, comment)
  }

  colString2000(name: string, comment: string): Column {
    return this.col(name, string2000, comment)
  }

  colSymbol(name: string, comment: string): Column {
    return this.col(name, symbol, comment)
  }

  colChar32(name: string, comment: string): Column {
    return this.col(name, char32, comment)
  }

  colNumberIdentity(name: string, comment: string): Column {
    return this.col(name, numberIdentity, comment)
  }

  colTimestampAudit(name: string, comment: string): Column {
    return this.col(name, timestampAudit, comment)
  }

  colJsonData(name: string, comment: string): Column {
    return this.col(name, jsonData, comment)
  }

  colGuidDefault(name: string, comment: string): Column {
    return this.col(name, guidDefault, comment)
  }

  primaryKey(columns: string[] | string): Table {
    return this.table.primaryKey(columns)
  }

  addIndexes(indexes: string[][]): Table {
    return this.table.addIndexes(indexes)
  }

  addIndex(columns: string[]): Table {
    return this.table.addIndex(columns)
  }

  render(): string {
    return this.table.render()
  }
}

export class Table {
  info: TableInfo = {
    name: '',
    columns: {},
    comment: '',
  }

  constructor(info?: TableInfo) {
    if (info) {
      this.info = info
    }
  }

  create(name: string, comment: string): Table {
    this.info = {
      name,
      comment,
      columns: {},
    }
    return this
  }

  primaryKey(columns: string[] | string): Table {
    this.info.primaryKey = columns
    return this
  }

  addColumn(name: string, column: ColumnInfo): Table {
    this.info.columns[name] = column
    return this
  }

  col(name: string, type: ColumnType, comment: string): Column {
    return new Column(this, name, type, comment)
  }

  addIndexes(indexes: string[][]): Table {
    this.info.indexes = indexes
    return this
  }

  addIndex(columns: string[]): Table {
    if (!this.info.indexes) {
      this.info.indexes = []
    }
    this.info.indexes.push(columns)
    return this
  }

  addConstraint(constraint: ConstraintInfo): Table {
    if (!this.info.constraints) {
      this.info.constraints = []
    }
    this.info.constraints.push(constraint)
    return this
  }

  validate() {
    // table name less than 30 characters
    if (this.info.name.length > 30) {
      throw new Error(`Table name ${this.info.name} exceeds 30 characters`)
    }

    // column names less than 30 characters
    for (const colName of Object.keys(this.info.columns)) {
      if (colName.length > 30) {
        throw new Error(`Column name ${colName} exceeds 30 characters`)
      }
    }

    // max string length 2000
    for (const [colName, column] of Object.entries(this.info.columns)) {
      if (column.type.type === 'string' && column.type.length > 2000) {
        throw new Error(`Column ${colName} string length exceeds 2000`)
      }
    }

    // primaryKey exists in columns
    if (this.info.primaryKey) {
      const pkCols = Array.isArray(this.info.primaryKey)
        ? this.info.primaryKey
        : [this.info.primaryKey]
      for (const pkCol of pkCols) {
        if (!this.info.columns[pkCol]) {
          throw new Error(`Primary key column ${pkCol} does not exist in table`)
        }
      }
    }

    // validate table-level indexes
    if (this.info.indexes) {
      for (const indexCols of this.info.indexes) {
        for (const col of indexCols) {
          if (!this.info.columns[col]) {
            throw new Error(`Index column ${col} does not exist in table`)
          }
        }
      }
    }

    return true
  }

  render(): string {
    this.validate()

    // drop table if exists
    let sql = `BEGIN\n`
    sql += `  EXECUTE IMMEDIATE 'DROP TABLE ${this.info.name}';\n`
    sql += `  DBMS_OUTPUT.PUT_LINE('Dropped table ${this.info.name}');\n`
    sql += `EXCEPTION\n`
    sql += `  WHEN OTHERS THEN\n`
    sql += `    IF SQLCODE != -942 THEN\n`
    sql += `      RAISE;\n`
    sql += `    END IF;\n`
    sql += `END;\n/\n\n`

    // create table
    sql += `CREATE TABLE ${this.info.name} (\n`
    const columnDefs = Object.entries(this.info.columns).map(([colName, col]) => {
      let colDef = `  ${colName} `
      if (col.type.type === 'number') {
        colDef += `NUMBER(${col.type.precision}`
        if (col.type.scale !== undefined) {
          colDef += `, ${col.type.scale}`
        }
        colDef += `)`
      } else if (col.type.type === 'string') {
        colDef += `VARCHAR2(${col.type.length} CHAR)`
      } else if (col.type.type === 'integer') {
        colDef += `NUMBER(19)`
      } else if (col.type.type === 'text') {
        colDef += `CLOB`
      } else if (col.type.type === 'binary') {
        colDef += `BLOB`
      } else if (col.type.type === 'symbol') {
        colDef += `CHAR(${col.type.length} CHAR)`
      } else if (col.type.type === 'datetime') {
        colDef += `TIMESTAMP`
      } else if (col.type.type === 'guid') {
        colDef += `RAW(16)`
      } else if (col.type.type === 'json') {
        colDef += `CLOB`
      }
      if (col.type.type === 'number' && 'identity' in col.type && col.type.identity) {
        colDef += ` GENERATED BY DEFAULT AS IDENTITY`
      } else if ('default' in col.type && col.type.default) {
        colDef += ` DEFAULT `
        if (typeof col.type.default === 'string') {
          colDef += `'${col.type.default}'`
        } else if (typeof col.type.default === 'number') {
          colDef += `${col.type.default}`
        } else if (typeof col.type.default === 'boolean') {
          if (col.type.type === 'guid' && col.type.default === true) {
            colDef += `SYS_GUID()`
          } else if (col.type.type === 'datetime' && col.type.default === true) {
            colDef += `SYSTIMESTAMP`
          }
        }
      }
      if (col.notNullable) {
        colDef += ' NOT NULL'
      }
      return colDef
    })
    sql += columnDefs.join(`, \n`)
    sql += `\n);`
    sql += `\n`

    // primary key
    if (this.info.primaryKey) {
      const pkCols = Array.isArray(this.info.primaryKey)
        ? this.info.primaryKey
        : [this.info.primaryKey]
      sql += `\nALTER TABLE ${this.info.name} ADD CONSTRAINT cpk_${this.info.name} PRIMARY KEY (${pkCols.join(
        ', ',
      )});\n`
    }

    // constraints from column definitions
    for (const [colName, col] of Object.entries(this.info.columns)) {
      // check constraint
      if (col.check) {
        if (Array.isArray(col.check)) {
          const values = col.check.map((v) => `'${v}'`).join(', ')
          sql += `\nALTER TABLE ${this.info.name} ADD CONSTRAINT chk_${this.info.name}_${colName} CHECK (${colName} IN (${values}));\n`
        } else {
          sql += `\nALTER TABLE ${this.info.name} ADD CONSTRAINT chk_${this.info.name}_${colName} CHECK (${col.check});\n`
        }
      }

      // reference constraint
      if (col.reference) {
        sql += `\nALTER TABLE ${this.info.name} ADD CONSTRAINT cfk_${this.info.name}_${colName} FOREIGN KEY (${colName}) REFERENCES ${col.reference.table} (${col.reference.column});\n`
      }

      // unique constraint
      if (col.unique) {
        sql += `\nALTER TABLE ${this.info.name} ADD CONSTRAINT cuq_${this.info.name}_${colName} UNIQUE (${colName});\n`
      }

      // index
      if (col.indexed) {
        sql += `\nCREATE INDEX idx_${this.info.name}_${colName} ON ${this.info.name} (${colName});\n`
      }

      // JSON constraint
      if (col.type.type === 'json') {
        sql += `\nALTER TABLE ${this.info.name} ADD CONSTRAINT chk_${this.info.name}_${colName}_json CHECK (${colName} IS JSON);\n`
      }
    }

    // table-level indexes
    if (this.info.indexes) {
      for (let i = 0; i < this.info.indexes.length; i++) {
        const indexCols = this.info.indexes[i]!
        const indexName = `idx_${this.info.name}_${indexCols.join('_')}`
        const colsList = indexCols.join(', ')
        sql += `\nCREATE INDEX ${indexName} ON ${this.info.name} (${colsList});\n`
      }
    }

    // comments
    sql += `\nCOMMENT ON TABLE ${this.info.name} IS '${this.info.comment}';`
    for (const [colName, col] of Object.entries(this.info.columns)) {
      sql += `\nCOMMENT ON COLUMN ${this.info.name}.${colName} IS '${col.comment}';`
    }
    sql += `\n`

    return sql
  }
}
