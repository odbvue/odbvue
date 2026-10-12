import { PlsqlExpression, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'
import type { OdbTypeDescriptor } from '../../schema/package.js'

const METHOD_GET = new PlsqlExpression('VARCHAR2', 'DBMS_CLOUD.METHOD_GET')

/** Typed wrappers for DBMS_CLOUD HTTP requests. Availability depends on the database. */
export const odbDbmsCloud = {
  response: { type: 'DBMS_CLOUD_TYPES.resp' } satisfies OdbTypeDescriptor<'DBMS_CLOUD_TYPES.resp'>,
  METHOD_GET,

  sendRequest(
    credentialName: PlsqlRenderable,
    uri: PlsqlRenderable,
    method: PlsqlRenderable = METHOD_GET,
  ): PlsqlExpression<'DBMS_CLOUD_TYPES.resp'> {
    return new PlsqlExpression(
      'DBMS_CLOUD_TYPES.resp',
      `DBMS_CLOUD.SEND_REQUEST(credential_name => ${renderPlsql(credentialName)}, uri => ${renderPlsql(uri)}, method => ${renderPlsql(method)})`,
    )
  },

  getResponseStatusCode(response: PlsqlRenderable): PlsqlExpression<'NUMBER'> {
    return new PlsqlExpression(
      'NUMBER',
      `DBMS_CLOUD.GET_RESPONSE_STATUS_CODE(${renderPlsql(response)})`,
    )
  },

  getResponseText(response: PlsqlRenderable): PlsqlExpression<'CLOB'> {
    return new PlsqlExpression('CLOB', `DBMS_CLOUD.GET_RESPONSE_TEXT(${renderPlsql(response)})`)
  },
}
