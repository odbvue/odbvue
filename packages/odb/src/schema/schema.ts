export type Grant = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | `EXECUTE ON ${string}`

export type SchemaNode = {
  kind: 'schema'
  name: string
  password?: string
  dataTablespace: string
  tempTablespace: string
  grants: Grant[]
  resourcePrincipalEnabled: boolean
}

export class Schema {
  private _password?: string
  private _dataTablespace: string = 'DATA'
  private _tempTablespace: string = 'TEMP'
  private _grants: Grant[] = []
  private _resourcePrincipalEnabled = false

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

  enableResourcePrincipal(): this {
    this._resourcePrincipalEnabled = true
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
      resourcePrincipalEnabled: this._resourcePrincipalEnabled,
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
      ...(this._resourcePrincipalEnabled
        ? [
            `BEGIN\n  DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL();\nEXCEPTION\n  WHEN OTHERS THEN\n    IF SQLCODE != -20031 THEN RAISE; END IF;\nEND;\n/`,
            `BEGIN\n  DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL(username => '${this.username.replace(/'/g, "''")}');\nEXCEPTION\n  WHEN OTHERS THEN\n    IF SQLCODE != -20031 THEN RAISE; END IF;\nEND;\n/`,
          ]
        : []),
    ].join('\n')
  }

  toSQLDown(): string {
    return [
      `BEGIN`,
      `  FOR r IN (`,
      `    SELECT sid, serial#`,
      `    FROM v$session`,
      `    WHERE username = UPPER('${this.username}')`,
      `  ) LOOP`,
      `    EXECUTE IMMEDIATE`,
      `      'ALTER SYSTEM KILL SESSION ''' || r.sid || ',' || r.serial# || ''' IMMEDIATE';`,
      `  END LOOP;`,
      `END;`,
      `/`,
      `DROP USER ${this.username} CASCADE;`,
    ].join('\n')
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
