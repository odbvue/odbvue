import { describe, expect, it } from 'vitest'
import { odbOrdsEndpoint } from '../../../src/ords.js'
import { PlsqlExpression } from '../../../src/schema/attribute.js'
import { odbHttp } from '../../../src/helpers/http/http.js'
import { ProcedureBody } from '../../../src/schema/package.js'

describe('odbHttp framework package', () => {
  it('installs a validated explicit HTTP error primitive', () => {
    const sql = odbHttp.toSQLUp({ schema: 'APP' })
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_http AS')
    expect(sql).toContain('raise_application_error(-20999')
    expect(sql).toContain("'ODB_HTTP|' || TO_CHAR(p_status) || '|' || p_code")
  })

  it('renders validated error calls and convenience methods', () => {
    const body = new ProcedureBody()
    body.httpError(422, 'INVALID_INPUT')

    expect(
      body.toNode().statements.map((statement) => ('sql' in statement ? statement.sql : '')),
    ).toEqual(["odb_http.raise_error(422, 'INVALID_INPUT')"])
    expect(() => body.httpError(200, 'OK')).toThrow('status must be an integer')
    expect(() => body.httpError(429, 'too-many')).toThrow('code must be uppercase')
  })

  it('renders transport-independent ODB errors', () => {
    const body = new ProcedureBody()
    body
      .notFound()
      .conflict()
      .invalid()
      .unauthorized('INVALID_CREDENTIALS')
      .forbidden()
      .tooManyRequests()

    expect(
      body.toNode().statements.map((statement) => ('sql' in statement ? statement.sql : '')),
    ).toEqual([
      "raise_application_error(-20998, 'ODB_ERROR|NOT_FOUND|NOT_FOUND')",
      "raise_application_error(-20998, 'ODB_ERROR|CONFLICT|CONFLICT')",
      "raise_application_error(-20998, 'ODB_ERROR|VALIDATION_ERROR|VALIDATION_ERROR')",
      "raise_application_error(-20998, 'ODB_ERROR|UNAUTHORIZED|INVALID_CREDENTIALS')",
      "raise_application_error(-20998, 'ODB_ERROR|FORBIDDEN|FORBIDDEN')",
      "raise_application_error(-20998, 'ODB_ERROR|TOO_MANY_REQUESTS|TOO_MANY_REQUESTS')",
    ])
    expect(() => body.notFound('not-found')).toThrow('code must be uppercase')
  })

  it('renders typed Set-Cookie values', () => {
    expect(
      odbHttp
        .setCookie({
          name: '__Host-token',
          value: new PlsqlExpression('VARCHAR2', 'p_token'),
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          maxAge: 60,
        })
        .toSQL(),
    ).toBe(
      "'__Host-token=' || p_token || '; Path=/' || '; HttpOnly' || '; Secure' || '; SameSite=Lax' || '; Max-Age=60'",
    )
    expect(() => odbHttp.setCookie({ name: 'token', value: 'p_token', maxAge: -1 })).toThrow(
      'maxAge must be a non-negative integer',
    )
  })

  it('extracts bearer tokens and named cookies from header values', () => {
    expect(odbHttp.bearerToken('p_authorization').toSQL()).toBe(
      "REGEXP_SUBSTR(p_authorization, '^Bearer[[:space:]]+(.+)$', 1, 1, 'i', 1)",
    )
    expect(odbHttp.cookie('p_cookie', '__Host-token').toSQL()).toBe(
      "REGEXP_SUBSTR(p_cookie, '(^|;[[:space:]]*)__Host-token=([^;]*)', 1, 1, NULL, 2)",
    )
    expect(() => odbHttp.cookie('p_cookie', "a.b'c")).toThrow('name may contain only')
  })

  it('defines a cookie with fixed attributes for read, set and expire', () => {
    const cookie = odbHttp.defineCookie({
      name: '__Host-token',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60,
    })
    expect(cookie.read('p_cookie').toSQL()).toBe(
      "REGEXP_SUBSTR(p_cookie, '(^|;[[:space:]]*)__Host-token=([^;]*)', 1, 1, NULL, 2)",
    )
    expect(cookie.set(new PlsqlExpression('VARCHAR2', 'l_token')).toSQL()).toBe(
      "'__Host-token=' || l_token || '; Path=/' || '; HttpOnly' || '; Secure' || '; SameSite=Lax' || '; Max-Age=60'",
    )
    expect(cookie.expire().toSQL()).toContain("'__Host-token=' || '' || '; Path=/'")
    expect(cookie.expire().toSQL()).toContain("'; Max-Age=0'")
    expect(() => odbHttp.defineCookie({ name: '__Host-token', path: '/' })).toThrow(
      '__Host- cookie requires',
    )
  })

  it('maps explicit errors and unexpected exceptions to JSON responses', () => {
    const source = odbOrdsEndpoint('test', 'api', 'limited').toNode().source

    expect(source).toContain('IF SQLCODE = -20999 THEN')
    expect(source).toContain(':status_code := TO_NUMBER(REGEXP_SUBSTR(SQLERRM')
    expect(source).toContain("htp.p(JSON_OBJECT('code' VALUE REGEXP_SUBSTR(SQLERRM")
    expect(source).not.toContain('RETURNING CLOB')
    expect(source).toContain('ELSIF SQLCODE = -20998 THEN')
    expect(source).toContain("WHEN 'NOT_FOUND' THEN 404")
    expect(source).toContain("WHEN 'CONFLICT' THEN 409")
    expect(source).toContain("WHEN 'UNAUTHORIZED' THEN 401")
    expect(source).toContain(':status_code := 500;')
    expect(source).toContain(`htp.p('{"code":"INTERNAL_SERVER_ERROR"}');`)
  })
})
