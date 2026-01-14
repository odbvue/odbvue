export type InOut = 'IN' | 'OUT' | 'IN OUT'

export const ParamType = {
  String: 'VARCHAR2',
  Integer: 'PLS_INTEGER',
  Number: 'NUMBER',
  DateTime: 'TIMESTAMP',
  Text: 'CLOB',
  Binary: 'BLOB',
  Object: 'SYS_REFCURSOR',
} as const

import { Query } from './query'
import { Insert } from './insert'
import { Update } from './update'
import { Upsert } from './upsert'

export type ProcedureInfo = {
  name: string
  parameters?: {
    [name: string]: {
      type: string
      inout: InOut
      noCopy?: boolean
      notNull?: boolean
      default?: string
      comment: string
    }
  }
  query?: Query
  cursorName?: string
  bodyStatement?: string
  insertStatement?: Insert
  updateStatement?: Update
  upsertStatement?: Upsert
  navigationGuard: 'none' | 'role' | 'any'
  navigationGuardRole?: string
  comment: string
}

export class Procedure {
  private info: ProcedureInfo

  constructor(name: string, comment: string) {
    this.info = { name, comment, navigationGuard: 'none' }
  }

  addParameter(
    name: string,
    type: string,
    comment: string,
    inout: InOut = 'IN',
    options?: { noCopy?: boolean; notNull?: boolean; default?: string },
  ): this {
    if (!this.info.parameters) {
      this.info.parameters = {}
    }
    this.info.parameters[name] = { type, inout, comment, ...options }
    return this
  }

  addQueryParameter(
    name: string,
    type: string,
    comment: string,
    options?: { noCopy?: boolean; notNull?: boolean },
  ): this {
    if (!this.info.parameters) {
      this.info.parameters = {}
    }
    this.info.parameters[name] = { type, inout: 'IN', comment, default: 'NULL', ...options }
    return this
  }

  returnQuery(query: Query, cursorName: string = 'r_result'): this {
    this.info.query = query
    this.info.cursorName = cursorName
    return this
  }

  navigationGuard(type: 'none' | 'role' | 'any', role?: string): this {
    this.info.navigationGuard = type
    this.info.navigationGuardRole = role
    return this
  }

  bodyStatement(statement: string): this {
    this.info.bodyStatement = statement
    return this
  }

  insertStatement(statement: Insert): this {
    this.info.insertStatement = statement
    return this
  }

  updateStatement(statement: Update): this {
    this.info.updateStatement = statement
    return this
  }

  upsertStatement(statement: Upsert): this {
    this.info.upsertStatement = statement
    return this
  }

  addResponse(name: string, type: string, comment: string): this {
    if (!this.info.parameters) {
      this.info.parameters = {}
    }
    this.info.parameters[name] = { type, inout: 'OUT', comment }
    return this
  }

  renderSpec(): string {
    let sql = `  PROCEDURE ${this.info.name}( -- ${this.info.comment}\n`
    if (this.info.parameters) {
      const paramEntries = Object.entries(this.info.parameters)
      const params = paramEntries.map(([name, param], index) => {
        let paramStr = `    ${name} ${param.inout} ${param.type}`
        if (param.noCopy) {
          paramStr = `NOCOPY ` + paramStr
        }
        if (param.notNull) {
          paramStr += ` NOT NULL`
        }
        if (param.default) {
          paramStr += ` DEFAULT ${param.default}`
        }
        if (index < paramEntries.length - 1) {
          paramStr += `,`
        }
        if (param.comment) {
          paramStr += ` -- ${param.comment}`
        }
        return paramStr
      })
      sql += params.join('\n')
    }
    sql += `\n  );\n\n`
    return sql
  }

  renderBody(): string {
    let sql = `  PROCEDURE ${this.info.name}(`
    if (this.info.parameters) {
      const paramEntries = Object.entries(this.info.parameters)
      const params = paramEntries.map(([name, param], index) => {
        let paramStr = `    ${name} ${param.inout} ${param.type}`
        if (param.noCopy) {
          paramStr = `NOCOPY ` + paramStr
        }
        if (param.notNull) {
          paramStr += ` NOT NULL`
        }
        if (param.default) {
          paramStr += ` DEFAULT ${param.default}`
        }
        if (index < paramEntries.length - 1) {
          paramStr += `,`
        }
        return paramStr
      })
      sql += `\n`
      sql += params.join('\n')
    }
    sql += `\n  ) IS\n  BEGIN\n`

    if (this.info.navigationGuard === 'role' && this.info.navigationGuardRole) {
      sql += `    IF pck_api_auth.role(NULL, '${this.info.navigationGuardRole}') IS NULL THEN\n`
      sql += `      pck_api_auth.http_401;\n`
      sql += `      RETURN;\n`
      sql += `    END IF;\n`
      sql += `\n`
    } else if (this.info.navigationGuard === 'any') {
      sql += `    IF pck_api_auth.uuid IS NULL THEN\n`
      sql += `      pck_api_auth.http_401;\n`
      sql += `      RETURN;\n`
      sql += `    END IF;\n`
      sql += `\n`
    }

    if (this.info.bodyStatement) {
      const stmtLines = this.info.bodyStatement.split('\n')
      sql += stmtLines.map((line) => `    ${line}`).join('\n')
      sql += `\n`
    } else if (this.info.upsertStatement) {
      const upsertSql = this.info.upsertStatement.toString()
      const upsertLines = upsertSql.split('\n')
      sql += upsertLines.map((line) => `    ${line}`).join('\n')
      sql += `\n`
    } else if (this.info.updateStatement || this.info.insertStatement) {
      if (this.info.updateStatement) {
        const updateSql = this.info.updateStatement.build()
        const updateLines = updateSql.split('\n')
        sql += updateLines.map((line) => `    ${line}`).join('\n')
        sql += `;\n\n`
      }
      if (this.info.insertStatement) {
        sql += `    IF SQL%rowcount = 0 THEN\n`
        const insertSql = this.info.insertStatement.build()
        const insertLines = insertSql.split('\n')
        sql += insertLines.map((line) => `      ${line}`).join('\n')
        sql += `;\n`
        sql += `    END IF;\n`
      }
      sql += `\n    COMMIT;\n`
    } else if (this.info.query) {
      const cursorName = this.info.cursorName || 'r_result'
      const queryStr = this.info.query.build()
      sql += `    OPEN ${cursorName} FOR\n`
      const queryLines = queryStr.split('\n')
      sql += queryLines.map((line) => `      ${line}`).join('\n')
      sql += `;\n`
    }

    sql += `\n  END ${this.info.name};\n\n`
    return sql
  }
}

export type PackageInfo = {
  name: string
  editionable?: boolean
  authid?: string
  comment: string
  procedures?: Procedure[]
}

export class Package {
  private info: PackageInfo

  constructor(name: string, comment: string) {
    this.info = { name, comment }
  }

  editionable(): this {
    this.info.editionable = true
    return this
  }

  authid(authid: string): this {
    this.info.authid = authid
    return this
  }

  addProcedure(procedure: Procedure): this {
    if (!this.info.procedures) {
      this.info.procedures = []
    }
    this.info.procedures.push(procedure)
    return this
  }

  render(): string {
    let sql = `CREATE OR REPLACE`
    if (this.info.editionable) {
      sql += ` EDITIONABLE`
    }
    sql += ` PACKAGE`
    if (this.info.authid) {
      sql += ` AUTHID ${this.info.authid}`
    }
    sql += ` ${this.info.name} AS -- ${this.info.comment}\n\n`

    if (this.info.procedures) {
      for (const procedure of this.info.procedures) {
        sql += procedure.renderSpec()
      }
    }

    sql += `END ${this.info.name};\n/\n\n`

    // body
    sql += `CREATE OR REPLACE PACKAGE BODY ${this.info.name} AS\n\n`

    if (this.info.procedures) {
      for (const procedure of this.info.procedures) {
        sql += procedure.renderBody()
      }
    }

    sql += `END ${this.info.name};\n/\n\n`

    return sql
  }
}
