const HTTP_ERROR_NUMBER = -20999
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,99}$/
import {
  odbLiteral,
  plsqlExpr,
  PlsqlExpression,
  PlsqlStatement,
  type PlsqlRenderable,
} from '../../../schema/attribute.js'
import { dropPackageIfExists, qualify } from '../../../schema/ddl.js'

function validateStatus(status: number): void {
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new Error('odbHttp: status must be an integer from 400 through 599.')
  }
}

function validateCode(code: string): void {
  if (!ERROR_CODE_PATTERN.test(code)) {
    throw new Error('odbHttp: code must be uppercase alphanumeric with optional underscores.')
  }
}

export type SetCookieOptions = {
  name: string
  value: PlsqlRenderable
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  maxAge?: number
}

/** Framework support for explicit HTTP errors from PL/SQL service bodies. */
export const odbHttp = {
  toSQLUp(options: { schema?: string } = {}): string {
    const name = qualify('odb_http', options.schema)
    return [
      `CREATE OR REPLACE PACKAGE ${name} AS`,
      `  PROCEDURE raise_error(p_status IN PLS_INTEGER, p_code IN VARCHAR2);`,
      `END odb_http;`,
      `/`,
      `CREATE OR REPLACE PACKAGE BODY ${name} AS`,
      `  PROCEDURE raise_error(p_status IN PLS_INTEGER, p_code IN VARCHAR2) IS`,
      `  BEGIN`,
      `    IF p_status NOT BETWEEN 400 AND 599 THEN`,
      `      raise_application_error(-20000, 'HTTP status must be from 400 through 599');`,
      `    END IF;`,
      `    IF NOT REGEXP_LIKE(p_code, '^[A-Z][A-Z0-9_]{0,99}$') THEN`,
      `      raise_application_error(-20000, 'HTTP error code is invalid');`,
      `    END IF;`,
      `    raise_application_error(${HTTP_ERROR_NUMBER}, 'ODB_HTTP|' || TO_CHAR(p_status) || '|' || p_code);`,
      `  END raise_error;`,
      `END odb_http;`,
      `/`,
    ].join('\n')
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return dropPackageIfExists('odb_http', options.schema)
  },
  error(status: number, code: string): PlsqlStatement {
    validateStatus(status)
    validateCode(code)
    return new PlsqlStatement(`odb_http.raise_error(${status}, '${code}')`)
  },
  unauthorized(code = 'UNAUTHORIZED'): PlsqlStatement {
    return this.error(401, code)
  },
  forbidden(code = 'FORBIDDEN'): PlsqlStatement {
    return this.error(403, code)
  },
  tooManyRequests(code = 'TOO_MANY_REQUESTS'): PlsqlStatement {
    return this.error(429, code)
  },
  setCookie(options: SetCookieOptions): PlsqlExpression<'VARCHAR2'> {
    if (!options.name) throw new Error('odbHttp.setCookie: name is required.')
    if (options.maxAge !== undefined && (!Number.isInteger(options.maxAge) || options.maxAge < 0)) {
      throw new Error('odbHttp.setCookie: maxAge must be a non-negative integer.')
    }
    const parts: PlsqlRenderable[] = [odbLiteral(`${options.name}=`), options.value]
    if (options.path) parts.push(odbLiteral(`; Path=${options.path}`))
    if (options.httpOnly) parts.push(odbLiteral('; HttpOnly'))
    if (options.secure) parts.push(odbLiteral('; Secure'))
    if (options.sameSite) parts.push(odbLiteral(`; SameSite=${options.sameSite}`))
    if (options.maxAge !== undefined) parts.push(odbLiteral(`; Max-Age=${options.maxAge}`))
    return plsqlExpr.concat(...parts)
  },
}
