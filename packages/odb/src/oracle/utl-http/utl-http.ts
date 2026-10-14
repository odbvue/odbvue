import type { OdbTypeDescriptor, PlsqlException } from '../../schema/package.js'
import {
  PlsqlExpression,
  PlsqlStatement,
  renderPlsql,
  type PlsqlRenderable,
} from '../../schema/attribute.js'

function call(name: string, ...args: PlsqlRenderable[]): PlsqlStatement {
  return new PlsqlStatement(`UTL_HTTP.${name}(${args.map(renderPlsql).join(', ')})`)
}

/** Oracle HTTP records and calls; TLS trust remains database-managed. */
export const odbUtlHttp = {
  context: { type: 'UTL_HTTP.REQUEST_CONTEXT_KEY' } as const satisfies OdbTypeDescriptor<string>,
  request: { type: 'UTL_HTTP.REQ' } as const satisfies OdbTypeDescriptor<string>,
  response: { type: 'UTL_HTTP.RESP' } as const satisfies OdbTypeDescriptor<string>,
  END_OF_BODY: { name: 'UTL_HTTP.END_OF_BODY' } satisfies PlsqlException,

  createRequestContext(enableCookies: boolean): PlsqlExpression<'UTL_HTTP.REQUEST_CONTEXT_KEY'> {
    return new PlsqlExpression(
      'UTL_HTTP.REQUEST_CONTEXT_KEY',
      `UTL_HTTP.CREATE_REQUEST_CONTEXT(enable_cookies => ${enableCookies ? 'TRUE' : 'FALSE'})`,
    )
  },
  destroyRequestContext(context: PlsqlRenderable): PlsqlStatement {
    return call('DESTROY_REQUEST_CONTEXT', context)
  },
  getTransferTimeout(timeout: PlsqlRenderable): PlsqlStatement {
    return call('GET_TRANSFER_TIMEOUT', timeout)
  },
  setTransferTimeout(timeout: PlsqlRenderable): PlsqlStatement {
    return call('SET_TRANSFER_TIMEOUT', timeout)
  },
  beginRequest(
    url: PlsqlRenderable,
    method: PlsqlRenderable,
    version: PlsqlRenderable,
    context: PlsqlRenderable,
  ): PlsqlExpression<'UTL_HTTP.REQ'> {
    return new PlsqlExpression(
      'UTL_HTTP.REQ',
      `UTL_HTTP.BEGIN_REQUEST(${[url, method, version].map(renderPlsql).join(', ')}, request_context => ${renderPlsql(context)})`,
    )
  },
  setFollowRedirect(request: PlsqlRenderable, count: PlsqlRenderable): PlsqlStatement {
    return call('SET_FOLLOW_REDIRECT', request, count)
  },
  setHeader(
    request: PlsqlRenderable,
    name: PlsqlRenderable,
    value: PlsqlRenderable,
  ): PlsqlStatement {
    return call('SET_HEADER', request, name, value)
  },
  writeRaw(request: PlsqlRenderable, bytes: PlsqlRenderable): PlsqlStatement {
    return call('WRITE_RAW', request, bytes)
  },
  getResponse(request: PlsqlRenderable): PlsqlExpression<'UTL_HTTP.RESP'> {
    return new PlsqlExpression('UTL_HTTP.RESP', `UTL_HTTP.GET_RESPONSE(${renderPlsql(request)})`)
  },
  readRaw(
    response: PlsqlRenderable,
    buffer: PlsqlRenderable,
    length: PlsqlRenderable,
  ): PlsqlStatement {
    return call('READ_RAW', response, buffer, length)
  },
  endResponse(response: PlsqlRenderable): PlsqlStatement {
    return call('END_RESPONSE', response)
  },
}
