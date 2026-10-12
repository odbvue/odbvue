import { describe, expect, expectTypeOf, it } from 'vitest'
import { odbDbmsCloud, odbOracle } from '../../../src/index.js'
import { odbLiteral, type PlsqlExpression } from '../../../src/schema/attribute.js'
import { odbPackage } from '../../../src/schema/package.js'

describe('DBMS_CLOUD', () => {
  it('renders typed HTTP request and response calls with named arguments', () => {
    const request = odbDbmsCloud.sendRequest(odbLiteral('OCI$RESOURCE_PRINCIPAL'), 'p_uri')
    expectTypeOf(request).toEqualTypeOf<PlsqlExpression<'DBMS_CLOUD_TYPES.resp'>>()
    expect(request.toSQL()).toBe(
      "DBMS_CLOUD.SEND_REQUEST(credential_name => 'OCI$RESOURCE_PRINCIPAL', uri => p_uri, method => DBMS_CLOUD.METHOD_GET)",
    )
    expect(
      odbDbmsCloud
        .sendRequest(odbLiteral("custom'credential"), 'p_uri', odbLiteral('POST'))
        .toSQL(),
    ).toContain("credential_name => 'custom''credential', uri => p_uri, method => 'POST'")
    const status = odbDbmsCloud.getResponseStatusCode('l_response')
    expectTypeOf(status).toEqualTypeOf<PlsqlExpression<'NUMBER'>>()
    expect(status.toSQL()).toBe('DBMS_CLOUD.GET_RESPONSE_STATUS_CODE(l_response)')
    const text = odbDbmsCloud.getResponseText('l_response')
    expectTypeOf(text).toEqualTypeOf<PlsqlExpression<'CLOB'>>()
    expect(text.toSQL()).toBe('DBMS_CLOUD.GET_RESPONSE_TEXT(l_response)')
  })

  it('integrates response records and CLOB values with the package builder', () => {
    const pkg = odbPackage('cloud_example', (p) => ({
      request: p.proc('request', {}, ({ body }) => {
        const { response, text } = body.variables({
          response: odbDbmsCloud.response,
          text: { type: 'CLOB' },
        })
        body.set(
          response,
          odbDbmsCloud.sendRequest(
            odbLiteral('OCI$RESOURCE_PRINCIPAL'),
            odbLiteral('https://example.com'),
          ),
        )
        body.set(text, odbDbmsCloud.getResponseText(response))
      }),
    }))
    expect(pkg.toSQLUp()).toContain('l_response DBMS_CLOUD_TYPES.resp;')
    expect(pkg.toSQLUp()).toContain('l_text := DBMS_CLOUD.GET_RESPONSE_TEXT(l_response)')
  })

  it('renders bounded JSON string extraction with explicit error handling', () => {
    const value = odbOracle.jsonValue('l_json', odbLiteral('$.secretBundleContent.content'), {
      length: 128,
      errorOnError: true,
    })
    expectTypeOf(value).toEqualTypeOf<PlsqlExpression<'VARCHAR2'>>()
    expect(value.toSQL()).toBe(
      "JSON_VALUE(l_json, '$.secretBundleContent.content' RETURNING VARCHAR2(128) ERROR ON ERROR)",
    )
    expect(odbOracle.jsonValue('l_json', odbLiteral('$.value')).toSQL()).toBe(
      "JSON_VALUE(l_json, '$.value')",
    )
    expect(odbOracle.jsonValue('l_json', odbLiteral('$.value'), { length: 1 }).toSQL()).toContain(
      'VARCHAR2(1)',
    )
    expect(
      odbOracle.jsonValue('l_json', odbLiteral('$.value'), { length: 32767 }).toSQL(),
    ).toContain('VARCHAR2(32767)')
    for (const length of [0, -1, 1.5, 32768, NaN]) {
      expect(() => odbOracle.jsonValue('l_json', odbLiteral('$.value'), { length })).toThrow(
        'length must be an integer',
      )
    }
  })
})
