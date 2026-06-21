export type ColumnType = 'string' | 'number' | 'guid' | 'boolean' | 'date' | 'timestamp' | 'clob'

export type ColumnOptions = {
  length?: number
  nullable?: boolean
  primaryKey?: boolean
  unique?: boolean
  default?: 'sys_guid' | 'current_timestamp' | string
}

export type ColumnNode = {
  kind: 'column'
  name: string
  type: ColumnType
  options: ColumnOptions
}

export class Column {
  private options: ColumnOptions

  constructor(
    readonly name: string,
    readonly type: ColumnType,
    options: ColumnOptions = {},
  ) {
    this.options = {
      nullable: true,
      ...options,
    }
  }

  notNull(): this {
    this.options.nullable = false
    return this
  }

  nullable(): this {
    this.options.nullable = true
    return this
  }

  primaryKey(): this {
    this.options.primaryKey = true
    this.options.nullable = false
    return this
  }

  unique(): this {
    this.options.unique = true
    return this
  }

  length(value: number): this {
    this.options.length = value
    return this
  }

  default(value: ColumnOptions['default']): this {
    this.options.default = value
    return this
  }

  defaultSysGuid(): this {
    this.options.default = 'sys_guid'
    this.options.nullable = false
    return this
  }

  defaultCurrentTimestamp(): this {
    this.options.default = 'current_timestamp'
    return this
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
