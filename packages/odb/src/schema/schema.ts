export type Grant = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | `EXECUTE ON ${string}`

export type SchemaNode = {
  kind: 'schema'
  name: string
  password?: string
  dataTablespace: string
  tempTablespace: string
  grants: Grant[]
}

export class Schema {
  private _password?: string
  private _dataTablespace: string = 'DATA'
  private _tempTablespace: string = 'TEMP'
  private _grants: Grant[] = []

  constructor(
    readonly username: string,
    password: string,
  ) {
    this._password = password
  }

  dataTablespace(name: string): this {
    this._dataTablespace = name
    return this
  }

  tempTablespace(name: string): this {
    this._tempTablespace = name
    return this
  }

  grant(privilege: Grant): this {
    this._grants.push(privilege)
    return this
  }

  toNode(): SchemaNode {
    return {
      kind: 'schema',
      name: this.username,
      password: this._password,
      dataTablespace: this._dataTablespace,
      tempTablespace: this._tempTablespace,
      grants: [...this._grants],
    }
  }

  toSQLUp(): string {
    return [
      `CREATE USER ${this.username} 
        IDENTIFIED BY "${this._password}" 
        DEFAULT TABLESPACE ${this._dataTablespace}
        TEMPORARY TABLESPACE ${this._tempTablespace}
        QUOTA UNLIMITED ON ${this._dataTablespace};`,
      `GRANT CREATE SESSION TO ${this.username};`,
      ...this._grants.map((grant) => `GRANT ${grant} TO ${this.username};`),
    ].join('\n')
  }

  toSQLDown(): string {
    return `DROP USER ${this.username} CASCADE;`
  }
}

export function odbSchema(
  username: string,
  password: string,
  build?: (schema: Schema) => void,
): Schema {
  const schema = new Schema(username, password)
  build?.(schema)
  return schema
}
