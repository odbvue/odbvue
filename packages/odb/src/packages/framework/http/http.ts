const HTTP_ERROR_NUMBER = -20999
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,99}$/
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
  error(status: number, code: string): string {
    validateStatus(status)
    validateCode(code)
    return `odb_http.raise_error(${status}, '${code}')`
  },
  unauthorized(code = 'UNAUTHORIZED'): string {
    return this.error(401, code)
  },
  forbidden(code = 'FORBIDDEN'): string {
    return this.error(403, code)
  },
  tooManyRequests(code = 'TOO_MANY_REQUESTS'): string {
    return this.error(429, code)
  },
}
