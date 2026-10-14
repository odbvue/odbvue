import { describe, expect, expectTypeOf, it } from 'vitest'
import { odbJson, odbOracle, odbUtlHttp, odbUtlI18n, odbUtlUrl } from '../../src/oracle/index.js'
import { cond, odbLiteral, type PlsqlExpression } from '../../src/schema/attribute.js'
import { odbPackage } from '../../src/schema/package.js'

describe('Oracle ports used by Google OIDC', () => {
  it('composes typed HTTP records and exception handlers without runtime import cycles', () => {
    const pkg = odbPackage('http_example', (p) => ({
      run: p.proc('run', {}, ({ body }) => {
        const { context, request, response } = body.variables({
          context: odbUtlHttp.context,
          request: odbUtlHttp.request,
          response: odbUtlHttp.response,
        })
        body.set(context, odbUtlHttp.createRequestContext(false))
        body.set(
          request,
          odbUtlHttp.beginRequest(
            odbLiteral('https://example.com'),
            odbLiteral('GET'),
            odbLiteral('HTTP/1.1'),
            context,
          ),
        )
        body.set(response, odbUtlHttp.getResponse(request))
        body.ifThen(cond.ne(response.field('status_code', 'NUMBER'), 200), (then) =>
          then.invalid('HTTP_STATUS'),
        )
        body.when(odbUtlHttp.END_OF_BODY, (done) => done.null())
      }),
    }))
    const sql = pkg.toSQLUp()
    expect(sql).toContain('l_context UTL_HTTP.REQUEST_CONTEXT_KEY;')
    expect(sql).toContain('l_request UTL_HTTP.REQ;')
    expect(sql).toContain('l_response UTL_HTTP.RESP;')
    expect(sql).toContain(
      "UTL_HTTP.BEGIN_REQUEST('https://example.com', 'GET', 'HTTP/1.1', request_context => l_context)",
    )
    expect(sql).toContain('l_response.status_code != 200')
    expect(sql).toContain('WHEN UTL_HTTP.END_OF_BODY THEN')
    expectTypeOf(odbUtlHttp.getResponse('request')).toEqualTypeOf<
      PlsqlExpression<'UTL_HTTP.RESP'>
    >()
    expect(odbUtlHttp.createRequestContext(true).toSQL()).toBe(
      'UTL_HTTP.CREATE_REQUEST_CONTEXT(enable_cookies => TRUE)',
    )
  })

  it('renders HTTP resource and timeout operations and safely quotes header literals', () => {
    expect(odbUtlHttp.getTransferTimeout('timeout').toSQL()).toBe(
      'UTL_HTTP.GET_TRANSFER_TIMEOUT(timeout)',
    )
    expect(odbUtlHttp.setTransferTimeout(odbLiteral(10)).toSQL()).toBe(
      'UTL_HTTP.SET_TRANSFER_TIMEOUT(10)',
    )
    expect(odbUtlHttp.setFollowRedirect('request', odbLiteral(0)).toSQL()).toBe(
      'UTL_HTTP.SET_FOLLOW_REDIRECT(request, 0)',
    )
    expect(odbUtlHttp.setHeader('request', odbLiteral('X-Name'), odbLiteral("a'b")).toSQL()).toBe(
      "UTL_HTTP.SET_HEADER(request, 'X-Name', 'a''b')",
    )
    expect(odbUtlHttp.writeRaw('request', 'bytes').toSQL()).toBe(
      'UTL_HTTP.WRITE_RAW(request, bytes)',
    )
    expect(odbUtlHttp.readRaw('response', 'buffer', odbLiteral(8192)).toSQL()).toBe(
      'UTL_HTTP.READ_RAW(response, buffer, 8192)',
    )
    expect(odbUtlHttp.endResponse('response').toSQL()).toBe('UTL_HTTP.END_RESPONSE(response)')
    expect(odbUtlHttp.destroyRequestContext('context').toSQL()).toBe(
      'UTL_HTTP.DESTROY_REQUEST_CONTEXT(context)',
    )
  })

  it('renders typed JSON parsing, access, and type checks independently of package builders', () => {
    expectTypeOf(odbJson.parse('document')).toEqualTypeOf<PlsqlExpression<'JSON_OBJECT_T'>>()
    expectTypeOf(odbJson.get('object', odbLiteral('key'))).toEqualTypeOf<
      PlsqlExpression<'JSON_ELEMENT_T'>
    >()
    expectTypeOf(odbJson.getArray('object', odbLiteral('keys'))).toEqualTypeOf<
      PlsqlExpression<'JSON_ARRAY_T'>
    >()
    expectTypeOf(odbJson.getBoolean('object', odbLiteral('verified'))).toEqualTypeOf<
      PlsqlExpression<'BOOLEAN'>
    >()
    expectTypeOf(odbJson.getKeys('object')).toEqualTypeOf<PlsqlExpression<'JSON_KEY_LIST'>>()
    expect(odbJson.parse('document').toSQL()).toBe('JSON_OBJECT_T.PARSE(document)')
    expect(odbJson.asObject('element').toSQL()).toBe('TREAT(element AS JSON_OBJECT_T)')
    expect(odbJson.onError('object', odbLiteral(1)).toSQL()).toBe('object.on_error(1)')
    expect(odbJson.has('object', odbLiteral("a'b")).toSQL()).toBe("object.has('a''b')")
    expect(odbJson.getKeys('object').toSQL()).toBe('object.get_keys()')
    expect(odbJson.keyAt('keys', odbLiteral(1)).toSQL()).toBe('keys(1)')
    expect(odbJson.get('array', odbLiteral(0)).toSQL()).toBe('array.get(0)')
    expect(odbJson.getString('array', odbLiteral(0)).toSQL()).toBe('array.get_string(0)')
    expect(odbJson.getNumber('object', odbLiteral('exp')).toSQL()).toBe("object.get_number('exp')")
    expect(odbJson.getArray('object', odbLiteral('keys')).toSQL()).toBe("object.get_array('keys')")
    expect(odbJson.getBoolean('object', odbLiteral('verified')).toSQL()).toBe(
      "object.get_boolean('verified')",
    )
    expect(odbJson.getSize('array').toSQL()).toBe('array.get_size()')
    for (const [call, name] of [
      [odbJson.isNull, 'is_null'],
      [odbJson.isString, 'is_string'],
      [odbJson.isNumber, 'is_number'],
      [odbJson.isBoolean, 'is_boolean'],
      [odbJson.isArray, 'is_array'],
      [odbJson.isObject, 'is_object'],
    ] as const) {
      expect(call('element').toSQL()).toBe(`element.${name}()`)
    }
  })

  it('preserves default SQL predicates and adds strict JSON, case-sensitive patterns, and encoding helpers', () => {
    const document = odbLiteral('{}')
    expect(cond.isJson(document).toSQL()).toBe("'{}' IS JSON")
    expect(cond.isJson(document, { strict: true, uniqueKeys: true }).toSQL()).toBe(
      "'{}' IS JSON STRICT WITH UNIQUE KEYS",
    )
    expect(cond.isJson(document, { uniqueKeys: true }).toSQL()).toBe(
      "'{}' IS JSON WITH UNIQUE KEYS",
    )
    expect(cond.regexpLike(document, '^x$').toSQL()).toBe("REGEXP_LIKE('{}', '^x$')")
    expect(cond.regexpLike(document, '^x$', 'c').toSQL()).toBe("REGEXP_LIKE('{}', '^x$', 'c')")
    expect(cond.regexpLike(document, '^x$', "c'").toSQL()).toBe("REGEXP_LIKE('{}', '^x$', 'c''')")
    expect(odbOracle.lpad('hex', 2, odbLiteral('0')).toSQL()).toBe("LPAD(hex, 2, '0')")
    expect(odbOracle.toNumber('hex').toSQL()).toBe('TO_NUMBER(hex)')
    expect(odbOracle.toNumber('hex', odbLiteral('XX')).toSQL()).toBe("TO_NUMBER(hex, 'XX')")
    expect(odbUtlI18n.rawToChar('bytes', odbLiteral('AL32UTF8')).toSQL()).toBe(
      "UTL_I18N.RAW_TO_CHAR(bytes, 'AL32UTF8')",
    )
    expect(odbUtlUrl.escape('value', true, odbLiteral('AL32UTF8')).toSQL()).toBe(
      "UTL_URL.ESCAPE(value, TRUE, 'AL32UTF8')",
    )
    expect(odbUtlUrl.escape('value', false, odbLiteral('AL32UTF8')).toSQL()).toBe(
      "UTL_URL.ESCAPE(value, FALSE, 'AL32UTF8')",
    )
  })
})
