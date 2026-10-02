import { odbPackage, odbType, type ProcedureBody } from '../../schema/package.js'
import {
  cond,
  odbLiteral,
  PlsqlExpression,
  PlsqlStatement,
  plsqlExpr,
  renderPlsql,
  type PlsqlRenderable,
  type PlsqlReference,
} from '../../schema/attribute.js'
import { odbOracle } from '../../oracle/index.js'
import { odbQuery } from '../../query/index.js'
import { SEVERITY_NUMBERS } from './constants.js'
import { auditLogs } from './tables.js'
import { auditTypes, withDefault } from './types.js'

const JSON_OBJECT = 'json_object_t'

function jsonParse(value: PlsqlRenderable): PlsqlExpression<typeof JSON_OBJECT> {
  return plsqlExpr.call(JSON_OBJECT, 'json_object_t.parse', value)
}

function jsonPut(
  target: { toSQL(): string },
  key: PlsqlRenderable,
  value: PlsqlRenderable,
): PlsqlStatement {
  return new PlsqlStatement(`${target.toSQL()}.put(${renderPlsql(key)}, ${renderPlsql(value)})`)
}

function jsonToClob(target: { toSQL(): string }): PlsqlExpression<'CLOB'> {
  return new PlsqlExpression('CLOB', `${target.toSQL()}.to_clob()`)
}

function callLog(...args: PlsqlRenderable[]): PlsqlStatement {
  return new PlsqlStatement(`log(${args.map(renderPlsql).join(', ')})`)
}

function severityNumberOf(severityText: PlsqlRenderable): PlsqlExpression<'PLS_INTEGER'> {
  const branches = Object.entries(SEVERITY_NUMBERS)
    .map(([name, number]) => `WHEN '${name}' THEN ${number}`)
    .join(' ')
  return new PlsqlExpression(
    'PLS_INTEGER',
    `CASE ${odbOracle.upper(severityText).toSQL()} ${branches} ELSE ${SEVERITY_NUMBERS.INFO} END`,
  )
}

function putWhenPresent(
  body: ProcedureBody,
  target: PlsqlReference,
  key: PlsqlRenderable,
  value: PlsqlExpression<any> | PlsqlReference,
): void {
  body.ifThen(cond.isNotNull(value), (then) => then.call(jsonPut(target, key, value)))
}

function cgiEnv(name: string): PlsqlExpression<'VARCHAR2'> {
  return odbOracle.trim(plsqlExpr.call('VARCHAR2', 'owa_util.get_cgi_env', odbLiteral(name)))
}

/**
 * PL/SQL API for the audit log. Callers pass severity, body, and optional JSON
 * attributes; the package enriches attributes with OTel resource, HTTP, and
 * exception keys and writes the row in an autonomous transaction.
 */
export const odbAuditPackage = odbPackage('odb_audit', (pkg) => {
  const list = pkg.proc(
    'list',
    {
      in: { after: auditTypes.id, limit: odbType.integer() },
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, items }, body }) => {
      const { afterTimestamp } = body.variables({ afterTimestamp: odbType.timestamp() })
      body.ifThen(cond.isNotNull(after), (then) => {
        then.query(
          odbQuery()
            .selectFrom(auditLogs)
            .select([auditLogs.observedTimestamp])
            .into(afterTimestamp)
            .where(cond.eq(auditLogs.id, after)),
        )
      })
      body.openFor(
        items,
        odbQuery()
          .selectFrom(auditLogs)
          .select([
            auditLogs.id,
            auditLogs.observedTimestamp,
            auditLogs.eventTimestamp,
            auditLogs.severityText,
            auditLogs.body,
            auditLogs.attributes,
          ])
          .where(
            cond.or([
              cond.isNull(after),
              cond.lt(auditLogs.observedTimestamp, afterTimestamp),
              cond.and([
                cond.eq(auditLogs.observedTimestamp, afterTimestamp),
                cond.lt(auditLogs.id, after),
              ]),
            ]),
          )
          .orderBy(auditLogs.observedTimestamp, 'desc')
          .orderBy(auditLogs.id, 'desc')
          .limit(odbOracle.nvl(limit, odbLiteral(50))),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.notFound('AUDIT_CURSOR_NOT_FOUND'))
    },
  )

  const severityNumber = pkg.func('severity_number', auditTypes.severityNumber, (fn) => {
    const { severityText } = fn.parameters({ in: { severityText: auditTypes.severityText } })
    fn.body((body) => body.return(severityNumberOf(severityText)))
  })

  const attributes = pkg.func('attributes', odbType.clob(), (fn) => {
    const { key1, value1, key2, value2, key3, value3, key4, value4, key5, value5, key6, value6 } =
      fn.parameters({
        in: {
          key1: auditTypes.attributeKey,
          value1: auditTypes.attributeValue,
          key2: withDefault(auditTypes.attributeKey, 'NULL'),
          value2: withDefault(auditTypes.attributeValue, 'NULL'),
          key3: withDefault(auditTypes.attributeKey, 'NULL'),
          value3: withDefault(auditTypes.attributeValue, 'NULL'),
          key4: withDefault(auditTypes.attributeKey, 'NULL'),
          value4: withDefault(auditTypes.attributeValue, 'NULL'),
          key5: withDefault(auditTypes.attributeKey, 'NULL'),
          value5: withDefault(auditTypes.attributeValue, 'NULL'),
          key6: withDefault(auditTypes.attributeKey, 'NULL'),
          value6: withDefault(auditTypes.attributeValue, 'NULL'),
        },
      })
    fn.body((body) => {
      const { json } = body.variables({ json: odbType.custom(JSON_OBJECT) })
      body.set(json, new PlsqlExpression(JSON_OBJECT, 'json_object_t()'))
      body.call(jsonPut(json, key1, value1))
      for (const [key, value] of [
        [key2, value2],
        [key3, value3],
        [key4, value4],
        [key5, value5],
        [key6, value6],
      ] as const) {
        body.ifThen(cond.isNotNull(key), (then) => then.call(jsonPut(json, key, value)))
      }
      body.return(jsonToClob(json))
    })
  })

  const log = pkg
    .proc(
      'log',
      {
        in: {
          severityText: auditTypes.severityText,
          body: auditTypes.body,
          attributes: withDefault(auditTypes.attributes, 'NULL'),
          eventTimestamp: withDefault(auditTypes.eventTimestamp, 'SYSTIMESTAMP'),
        },
      },
      ({ params, body }) => {
        const {
          parsed,
          serviceName,
          requestMethod,
          requestUri,
          agent,
          ipAddress,
          errorMessage,
          errorBacktrace,
          attributesClob,
        } = body.variables({
          parsed: odbType.custom(JSON_OBJECT),
          serviceName: odbType.string(255),
          requestMethod: odbType.string(30),
          requestUri: odbType.string(2000),
          agent: odbType.string(2000),
          ipAddress: odbType.string(200),
          errorMessage: odbType.string(2000),
          errorBacktrace: odbType.string(2000),
          attributesClob: odbType.clob(),
        })
        body.set(parsed, jsonParse(odbOracle.nvl(params.attributes, odbLiteral('{}'))))
        body.block((inner) => {
          inner.set(
            serviceName,
            odbOracle.lower(
              plsqlExpr.call(
                'VARCHAR2',
                'SYS_CONTEXT',
                odbLiteral('USERENV'),
                odbLiteral('DB_NAME'),
              ),
            ),
          )
          inner.ifThen(cond.isNotNull(serviceName), (then) =>
            then.call(jsonPut(parsed, odbLiteral('service.name'), serviceName)),
          )
          inner.whenOthers((handler) => handler.null())
        })
        body.block((inner) => {
          inner.set(requestMethod, cgiEnv('REQUEST_METHOD'))
          inner.set(requestUri, cgiEnv('SCRIPT_NAME'))
          inner.set(agent, cgiEnv('HTTP_USER_AGENT'))
          inner.set(ipAddress, cgiEnv('REMOTE_ADDR'))
          inner.whenOthers((handler) => handler.null())
        })
        putWhenPresent(body, parsed, odbLiteral('http.request.method'), requestMethod)
        putWhenPresent(body, parsed, odbLiteral('url.path'), requestUri)
        putWhenPresent(body, parsed, odbLiteral('user_agent.original'), agent)
        putWhenPresent(body, parsed, odbLiteral('client.address'), ipAddress)
        body.block((inner) => {
          inner.set(errorMessage, odbOracle.substr(plsqlExpr.call('VARCHAR2', 'SQLERRM'), 1, 2000))
          inner.set(
            errorBacktrace,
            odbOracle.substr(
              plsqlExpr.call('VARCHAR2', 'DBMS_UTILITY.FORMAT_ERROR_BACKTRACE'),
              1,
              2000,
            ),
          )
          inner.ifThen(
            cond.eq(odbOracle.substr(errorMessage, 1, 8), odbLiteral('ORA-0000')),
            (then) => {
              then.set(errorMessage, null)
              then.set(errorBacktrace, null)
            },
          )
          inner.whenOthers((handler) => handler.null())
        })
        putWhenPresent(body, parsed, odbLiteral('exception.message'), errorMessage)
        putWhenPresent(body, parsed, odbLiteral('exception.stacktrace'), errorBacktrace)
        body.set(attributesClob, jsonToClob(parsed))
        body.insertInto(auditLogs, {
          severityText: odbOracle.upper(params.severityText),
          severityNumber: severityNumber.invoke(params.severityText),
          body: params.body,
          attributes: attributesClob,
          eventTimestamp: params.eventTimestamp,
        })
        body.commit()
      },
    )
    .autonomous()

  const debug = pkg.proc(
    'debug',
    {
      in: {
        body: auditTypes.body,
        attributes: withDefault(auditTypes.attributes, 'NULL'),
      },
    },
    ({ params, body }) => {
      body.call(callLog(odbLiteral('DEBUG'), params.body, params.attributes))
    },
  )

  const info = pkg.proc(
    'info',
    {
      in: {
        body: auditTypes.body,
        attributes: withDefault(auditTypes.attributes, 'NULL'),
      },
    },
    ({ params, body }) => {
      body.call(callLog(odbLiteral('INFO'), params.body, params.attributes))
    },
  )

  const warn = pkg.proc(
    'warn',
    {
      in: {
        body: auditTypes.body,
        attributes: withDefault(auditTypes.attributes, 'NULL'),
      },
    },
    ({ params, body }) => {
      body.call(callLog(odbLiteral('WARN'), params.body, params.attributes))
    },
  )

  const error = pkg.proc(
    'error',
    {
      in: {
        body: auditTypes.body,
        attributes: withDefault(auditTypes.attributes, 'NULL'),
      },
    },
    ({ params, body }) => {
      body.call(callLog(odbLiteral('ERROR'), params.body, params.attributes))
    },
  )

  const fatal = pkg.proc(
    'fatal',
    {
      in: {
        body: auditTypes.body,
        attributes: withDefault(auditTypes.attributes, 'NULL'),
      },
    },
    ({ params, body }) => {
      body.call(callLog(odbLiteral('FATAL'), params.body, params.attributes))
    },
  )

  const bulk = pkg.proc('bulk', { in: { data: auditTypes.attributes } }, ({ params, body }) => {
    body.forQuery(
      'rec',
      odbQuery()
        .selectFrom(
          `JSON_TABLE(${renderPlsql(params.data)}, '$[*]' COLUMNS (severity_text VARCHAR2(30 CHAR) PATH '$.severity_text', body VARCHAR2(2000 CHAR) PATH '$.body', attributes CLOB FORMAT JSON PATH '$.attributes', event_timestamp TIMESTAMP PATH '$.event_timestamp'))`,
        )
        .select(['severity_text', 'body', 'attributes', 'event_timestamp']),
      (rec, loop) => {
        loop.call(
          callLog(
            rec.column('severity_text'),
            rec.column('body'),
            rec.column('attributes', 'CLOB'),
            odbOracle.nvl(rec.column('event_timestamp', 'TIMESTAMP'), odbOracle.sysTimestamp()),
          ),
        )
      },
    )
  })

  const purge = pkg
    .proc('purge', { in: { olderThan: auditTypes.eventTimestamp } }, ({ params, body }) => {
      body.query(
        odbQuery().deleteFrom(auditLogs).where(cond.lt(auditLogs.eventTimestamp, params.olderThan)),
      )
      body.commit()
    })
    .autonomous()

  return {
    list,
    severityNumber,
    attributes,
    log,
    debug,
    info,
    warn,
    error,
    fatal,
    bulk,
    purge,
  }
})
