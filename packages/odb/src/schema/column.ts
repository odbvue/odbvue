import {
  emitOracleType,
  type OdbColumnType,
  type OdbValueForType,
  type OdbValueTypeMap,
} from '../model.js'

export type ColumnType = OdbColumnType

export type ColumnValueTypeMap = Pick<OdbValueTypeMap, ColumnType>

export type ColumnValueForType<TType extends ColumnType> = OdbValueForType<TType>

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
  TType extends ColumnType = ColumnType,
> {
  private options: ColumnOptions
  private readonly _valueType?: TValue

  constructor(
    readonly name: TName,
    readonly type: TType,
    options: ColumnOptions = {},
  ) {
    this.options = {
      nullable: true,
      ...options,
    }
  }

  notNull(): Column<TValue, TName, false, TDefault, TGenerated, TPrimaryKey, TType> {
    this.options.nullable = false
    return this as Column<TValue, TName, false, TDefault, TGenerated, TPrimaryKey, TType>
  }

  nullable(): Column<TValue, TName, true, TDefault, TGenerated, TPrimaryKey, TType> {
    this.options.nullable = true
    return this as Column<TValue, TName, true, TDefault, TGenerated, TPrimaryKey, TType>
  }

  primaryKey(): Column<TValue, TName, false, TDefault, TGenerated, true, TType> {
    this.options.primaryKey = true
    this.options.nullable = false
    return this as Column<TValue, TName, false, TDefault, TGenerated, true, TType>
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
  ): Column<TValue, TName, TNullable, true, TGenerated, TPrimaryKey, TType> {
    this.options.default = value
    return this as Column<TValue, TName, TNullable, true, TGenerated, TPrimaryKey, TType>
  }

  defaultSysGuid(
    this: Column<TValue, TName, TNullable, TDefault, TGenerated, TPrimaryKey, 'guid'>,
  ): Column<TValue, TName, false, true, TGenerated, TPrimaryKey, 'guid'> {
    this.options.default = 'sys_guid'
    this.options.nullable = false
    return this as Column<TValue, TName, false, true, TGenerated, TPrimaryKey, 'guid'>
  }

  defaultCurrentTimestamp(
    this: Column<TValue, TName, TNullable, TDefault, TGenerated, TPrimaryKey, 'date' | 'timestamp'>,
  ): Column<TValue, TName, TNullable, true, TGenerated, TPrimaryKey, TType> {
    this.options.default = 'current_timestamp'
    return this as Column<TValue, TName, TNullable, true, TGenerated, TPrimaryKey, TType>
  }

  generated(): Column<TValue, TName, TNullable, TDefault, true, TPrimaryKey, TType> {
    this.options.generated = true
    return this as Column<TValue, TName, TNullable, TDefault, true, TPrimaryKey, TType>
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
  return emitOracleType(column.type, column.options)
}
