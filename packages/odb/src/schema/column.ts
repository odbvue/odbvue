export type ColumnType = 'string' | 'number' | 'guid' | 'boolean' | 'date' | 'timestamp' | 'clob'

export type ColumnValueTypeMap = {
  string: string
  number: number
  guid: string
  boolean: boolean
  date: Date
  timestamp: Date
  clob: string
}

export type ColumnValueForType<TType extends ColumnType> = ColumnValueTypeMap[TType]

export type ColumnOptions = {
  length?: number
  nullable?: boolean
  primaryKey?: boolean
  generated?: boolean
  unique?: boolean
  default?: 'sys_guid' | 'current_timestamp' | string
}

export type ColumnNode = {
  kind: 'column'
  name: string
  type: ColumnType
  options: ColumnOptions
}

export class Column<
  TValue = unknown,
  TName extends string = string,
  TNullable extends boolean = true,
  TDefault extends boolean = false,
  TGenerated extends boolean = false,
  TPrimaryKey extends boolean = false,
> {
  private options: ColumnOptions
  private readonly _valueType?: TValue

  constructor(
    readonly name: TName,
    readonly type: ColumnType,
    options: ColumnOptions = {},
  ) {
    this.options = {
      nullable: true,
      ...options,
    }
  }

  notNull(): Column<TValue, TName, false, TDefault, TGenerated, TPrimaryKey> {
    this.options.nullable = false
    return this as Column<TValue, TName, false, TDefault, TGenerated, TPrimaryKey>
  }

  nullable(): Column<TValue, TName, true, TDefault, TGenerated, TPrimaryKey> {
    this.options.nullable = true
    return this as Column<TValue, TName, true, TDefault, TGenerated, TPrimaryKey>
  }

  primaryKey(): Column<TValue, TName, false, TDefault, TGenerated, true> {
    this.options.primaryKey = true
    this.options.nullable = false
    return this as Column<TValue, TName, false, TDefault, TGenerated, true>
  }

  unique(): this {
    this.options.unique = true
    return this
  }

  length(value: number): this {
    this.options.length = value
    return this
  }

  default(
    value: ColumnOptions['default'],
  ): Column<TValue, TName, TNullable, true, TGenerated, TPrimaryKey> {
    this.options.default = value
    return this as Column<TValue, TName, TNullable, true, TGenerated, TPrimaryKey>
  }

  defaultSysGuid(): Column<TValue, TName, false, true, TGenerated, TPrimaryKey> {
    this.options.default = 'sys_guid'
    this.options.nullable = false
    return this as Column<TValue, TName, false, true, TGenerated, TPrimaryKey>
  }

  defaultCurrentTimestamp(): Column<TValue, TName, TNullable, true, TGenerated, TPrimaryKey> {
    this.options.default = 'current_timestamp'
    return this as Column<TValue, TName, TNullable, true, TGenerated, TPrimaryKey>
  }

  generated(): Column<TValue, TName, TNullable, TDefault, true, TPrimaryKey> {
    this.options.generated = true
    return this as Column<TValue, TName, TNullable, TDefault, true, TPrimaryKey>
  }

  toSQL(): string {
    return this.name
  }

  toNode(): ColumnNode {
    return {
      kind: 'column',
      name: this.name,
      type: this.type,
      options: { ...this.options },
    }
  }

  toObject() {
    return this.toNode()
  }
}

export function emitColumnDef(column: ColumnNode): string {
  const parts = [column.name, emitColumnType(column)]

  if (column.options.default === 'sys_guid') {
    parts.push('DEFAULT SYS_GUID()')
  } else if (column.options.default === 'current_timestamp') {
    parts.push('DEFAULT CURRENT_TIMESTAMP')
  } else if (column.options.default) {
    parts.push(`DEFAULT ${column.options.default}`)
  }

  if (column.options.nullable === false) {
    parts.push('NOT NULL')
  }

  if (column.options.unique) {
    parts.push('UNIQUE')
  }

  return parts.join(' ')
}

export function emitColumnType(column: ColumnNode): string {
  switch (column.type) {
    case 'string':
      return `VARCHAR2(${column.options.length ?? 255} CHAR)`
    case 'number':
      return 'NUMBER'
    case 'guid':
      return 'RAW(16)'
    case 'boolean':
      return 'NUMBER(1)'
    case 'date':
      return 'DATE'
    case 'timestamp':
      return 'TIMESTAMP(6)'
    case 'clob':
      return 'CLOB'
  }
}
