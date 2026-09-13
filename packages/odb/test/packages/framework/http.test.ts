import { describe, expect, it } from 'vitest'
import { odbOrdsEndpoint } from '../../../src/ords.js'
import { odbHttp } from '../../../src/packages/framework/http/http.js'
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
    body.httpError(422, 'INVALID_INPUT').unauthorized().forbidden().tooManyRequests()

    expect(
      body.toNode().statements.map((statement) => ('sql' in statement ? statement.sql : '')),
    ).toEqual([
      "odb_http.raise_error(422, 'INVALID_INPUT')",
      "odb_http.raise_error(401, 'UNAUTHORIZED')",
      "odb_http.raise_error(403, 'FORBIDDEN')",
      "odb_http.raise_error(429, 'TOO_MANY_REQUESTS')",
    ])
    expect(() => body.httpError(200, 'OK')).toThrow('status must be an integer')
    expect(() => body.httpError(429, 'too-many')).toThrow('code must be uppercase')
  })

  it('maps explicit errors and unexpected exceptions to JSON responses', () => {
    const source = odbOrdsEndpoint('test', 'api', 'limited').toNode().source

    expect(source).toContain('IF SQLCODE = -20999 THEN')
    expect(source).toContain(':status_code := TO_NUMBER(REGEXP_SUBSTR(SQLERRM')
    expect(source).toContain("htp.p(JSON_OBJECT('code' VALUE REGEXP_SUBSTR(SQLERRM")
    expect(source).not.toContain('RETURNING CLOB')
    expect(source).toContain(':status_code := 500;')
    expect(source).toContain(`htp.p('{"code":"INTERNAL_SERVER_ERROR"}');`)
  })
})
