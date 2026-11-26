import { ODB_ERROR_CODE_PATTERN, ODB_ERROR_NUMBER, validateHttpError } from '../../schema/errors.js'
import {
  cond,
  odbLiteral,
  plsqlCall,
  plsqlExpr,
  renderPlsql,
  PlsqlExpression,
  PlsqlStatement,
  type PlsqlRenderable,
} from '../../schema/attribute.js'
import { dropPackageIfExists } from '../../schema/ddl.js'
import { odbBlockStatement, odbPackage, odbType } from '../../schema/package.js'
import { odbDbmsLob, odbOracle, odbUtlUrl } from '../../oracle/index.js'

const COOKIE_NAME_PATTERN = /^[A-Za-z0-9_-]+$/

function httpPackage() {
  return odbPackage('odb_http', (pkg) => ({
    raiseError: pkg.proc(
      'raise_error',
      { in: { status: odbType.integer(), code: odbType.string() } },
      ({ params: { status, code }, body }) => {
        body.ifThen(
          cond.or([cond.isNull(status), cond.lt(status, 400), cond.gt(status, 599)]),
          (invalid) =>
            invalid.raiseApplicationError(
              -20000,
              odbLiteral('HTTP status must be from 400 through 599'),
            ),
        )
        body.ifThen(
          cond.or([
            cond.isNull(code),
            cond.not(cond.regexpLike(code, ODB_ERROR_CODE_PATTERN.source)),
          ]),
          (invalid) =>
            invalid.raiseApplicationError(-20000, odbLiteral('HTTP error code is invalid')),
        )
        body.raiseApplicationError(
          ODB_ERROR_NUMBER,
          plsqlExpr.concat('ODB_ERROR|', odbOracle.toChar(status), '|', code),
        )
      },
    ),
  }))
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
    return httpPackage().toSQLUp(options)
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return dropPackageIfExists('odb_http', options.schema)
  },
  error(status: number, code: string): PlsqlStatement {
    validateHttpError(status, code, 'odbHttp')
    return httpPackage().raiseError(odbLiteral(status), odbLiteral(code))
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
    return odbBlockStatement((body) => {
      const { downloadName, downloadMime } = body.variables(
        {
          downloadName: odbType.string(255),
          downloadMime: odbType.string(200),
        },
        { prefix: 'v' },
      )
      downloadName.initialize(new PlsqlExpression('VARCHAR2', renderPlsql(fileName)))
      downloadMime.initialize(new PlsqlExpression('VARCHAR2', renderPlsql(mimeType)))
      body.ifThen(
        cond.or([
          cond.isNull(downloadMime),
          cond.not(cond.regexpLike(downloadMime, '^[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+$')),
        ]),
        (invalid) => invalid.set(downloadMime, 'application/octet-stream'),
      )
      body.call(plsqlCall('owa_util.mime_header', downloadMime, false))
      body.call(
        plsqlCall('htp.p', plsqlExpr.concat('Content-Length: ', odbDbmsLob.getLength(content))),
      )
      body.call(
        plsqlCall(
          'htp.p',
          plsqlExpr.concat(
            'Content-Disposition: attachment; filename="',
            odbOracle.regexpReplace(downloadName, odbLiteral('[^A-Za-z0-9._ -]'), odbLiteral('_')),
            `"; filename*=UTF-8''`,
            odbOracle.replace(
              odbUtlUrl.escape(downloadName, true, odbLiteral('AL32UTF8')),
              odbLiteral("'"),
              odbLiteral('%27'),
            ),
          ),
        ),
      )
      body.call(plsqlCall('htp.p', odbLiteral('Cache-Control: private, no-store')))
      body.call(plsqlCall('htp.p', odbLiteral('X-Content-Type-Options: nosniff')))
      body.call(plsqlCall('owa_util.http_header_close'))
      body.call(plsqlCall('wpg_docload.download_file', content))
    })
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
