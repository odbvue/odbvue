const HTTP_ERROR_NUMBER = -20999
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,99}$/
import {
  odbLiteral,
  plsqlExpr,
  renderPlsql,
  PlsqlExpression,
  PlsqlStatement,
  type PlsqlRenderable,
} from '../../schema/attribute.js'
import { dropPackageIfExists, qualify } from '../../schema/ddl.js'
import { odbOracle } from '../../oracle/index.js'

const COOKIE_NAME_PATTERN = /^[A-Za-z0-9_-]+$/

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
  download(
    content: PlsqlRenderable,
    fileName: PlsqlRenderable,
    mimeType: PlsqlRenderable,
  ): PlsqlStatement {
    return new PlsqlStatement(
      [
        'DECLARE',
        `  v_download_name VARCHAR2(255) := ${renderPlsql(fileName)};`,
        `  v_download_mime VARCHAR2(200) := ${renderPlsql(mimeType)};`,
        'BEGIN',
        "  IF v_download_mime IS NULL OR NOT REGEXP_LIKE(v_download_mime, '^[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+$') THEN",
        "    v_download_mime := 'application/octet-stream';",
        '  END IF;',
        '  owa_util.mime_header(v_download_mime, FALSE);',
        `  htp.p('Content-Length: ' || DBMS_LOB.GETLENGTH(${renderPlsql(content)}));`,
        `  htp.p('Content-Disposition: attachment; filename="' || REGEXP_REPLACE(v_download_name, '[^A-Za-z0-9._ -]', '_') || '"; filename*=UTF-8''''' || REPLACE(UTL_URL.ESCAPE(v_download_name, TRUE, 'AL32UTF8'), '''', '%27'));`,
        "  htp.p('Cache-Control: private, no-store');",
        "  htp.p('X-Content-Type-Options: nosniff');",
        '  owa_util.http_header_close;',
        `  wpg_docload.download_file(${renderPlsql(content)});`,
        'END',
      ].join('\n'),
    )
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
  /** Token from an `Authorization: Bearer <token>` header value; NULL when absent or malformed. */
  bearerToken(authorization: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return odbOracle.regexpSubstr(authorization, odbLiteral('^Bearer[[:space:]]+(.+)$'), {
      position: 1,
      occurrence: 1,
      matchParameter: odbLiteral('i'),
      subexpression: 1,
    })
  },
  /** Value of the named cookie in a `Cookie` header value; NULL when absent. */
  cookie(header: PlsqlRenderable, name: string): PlsqlExpression<'VARCHAR2'> {
    if (!COOKIE_NAME_PATTERN.test(name)) {
      throw new Error('odbHttp.cookie: name may contain only letters, digits, "_" and "-".')
    }
    return odbOracle.regexpSubstr(header, odbLiteral(`(^|;[[:space:]]*)${name}=([^;]*)`), {
      position: 1,
      occurrence: 1,
      matchParameter: odbOracle.null(),
      subexpression: 2,
    })
  },
  /** A named cookie with fixed attributes: read it from a request, set it, or expire it in a response. */
  defineCookie(options: Omit<SetCookieOptions, 'value'>) {
    const { name, ...attributes } = options
    if (name.startsWith('__Host-') && (!attributes.secure || attributes.path !== '/')) {
      throw new Error('odbHttp.defineCookie: a __Host- cookie requires secure and path "/".')
    }
    return {
      name,
      /** Cookie value from a `Cookie` header value; NULL when absent. */
      read: (header: PlsqlRenderable) => odbHttp.cookie(header, name),
      /** `Set-Cookie` value carrying `value`, with the configured `maxAge` unless overridden. */
      set: (value: PlsqlRenderable, maxAge = attributes.maxAge) =>
        odbHttp.setCookie({ ...attributes, name, value, maxAge }),
      /** `Set-Cookie` value that clears the cookie in the browser. */
      expire: () => odbHttp.setCookie({ ...attributes, name, value: odbLiteral(''), maxAge: 0 }),
    }
  },
}
