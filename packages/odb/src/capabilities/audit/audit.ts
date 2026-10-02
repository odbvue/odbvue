// Audit capability: `odb_audit_logs` table and the `odb_audit` PL/SQL package, both defined in
// TypeScript. The package writes OpenTelemetry LogRecords (logs only) in an autonomous transaction
// and enriches attributes with resource, HTTP, and exception keys.

import {
  PlsqlExpression,
  PlsqlStatement,
  renderPlsql,
  type PlsqlRenderable,
} from '../../schema/attribute.js'
import { odbAuditPackage } from './package.js'
import { auditLogs } from './tables.js'
import { auditTypes } from './types.js'

function severityCall(name: string, message: PlsqlRenderable, attributes?: PlsqlRenderable) {
  return new PlsqlStatement(
    attributes === undefined
      ? `odb_audit.${name}(${renderPlsql(message)})`
      : `odb_audit.${name}(${renderPlsql(message)}, ${renderPlsql(attributes)})`,
  )
}

/** Installable audit capability plus typed calls into `odb_audit`. */
export const odbAudit = {
  toSQLUp(options: { schema?: string } = {}): string {
    return [auditLogs.toSQLUp(options), odbAuditPackage.toSQLUp(options)].join('\n')
  },

  toSQLDown(options: { schema?: string } = {}): string {
    return [odbAuditPackage.toSQLDown(options), auditLogs.toSQLDown(options)].join('\n')
  },

  /** Parameter types for declaring procedures that pass audit values through, without knowing the table. */
  types: auditTypes,

  /** Newest-first keyset page; NULL starts the list and a NULL limit defaults to 50. */
  list(after: PlsqlRenderable, limit: PlsqlRenderable, items: PlsqlRenderable): PlsqlStatement {
    return odbAuditPackage.list(after, limit, items)
  },

  /** `odb_audit.log(<severity>, <body>[, <attributes>[, <event_timestamp>]])` */
  log(
    severity: PlsqlRenderable,
    message: PlsqlRenderable,
    attributes?: PlsqlRenderable,
    eventTimestamp?: PlsqlRenderable,
  ): PlsqlStatement {
    const args = [severity, message]
    if (attributes !== undefined || eventTimestamp !== undefined) args.push(attributes ?? 'NULL')
    if (eventTimestamp !== undefined) args.push(eventTimestamp)
    return odbAuditPackage.log(...args)
  },

  /** `odb_audit.debug(<body>[, <attributes>])` */
  debug(message: PlsqlRenderable, attributes?: PlsqlRenderable): PlsqlStatement {
    return severityCall('debug', message, attributes)
  },

  /** `odb_audit.info(<body>[, <attributes>])` */
  info(message: PlsqlRenderable, attributes?: PlsqlRenderable): PlsqlStatement {
    return severityCall('info', message, attributes)
  },

  /** `odb_audit.warn(<body>[, <attributes>])` */
  warn(message: PlsqlRenderable, attributes?: PlsqlRenderable): PlsqlStatement {
    return severityCall('warn', message, attributes)
  },

  /** `odb_audit.error(<body>[, <attributes>])` */
  error(message: PlsqlRenderable, attributes?: PlsqlRenderable): PlsqlStatement {
    return severityCall('error', message, attributes)
  },

  /** `odb_audit.fatal(<body>[, <attributes>])` */
  fatal(message: PlsqlRenderable, attributes?: PlsqlRenderable): PlsqlStatement {
    return severityCall('fatal', message, attributes)
  },

  /** `odb_audit.severity_number(<severity>)` → PLS_INTEGER (OTel SeverityNumber) */
  severityNumber(severity: PlsqlRenderable): PlsqlExpression<'PLS_INTEGER'> {
    return new PlsqlExpression('PLS_INTEGER', `odb_audit.severity_number(${renderPlsql(severity)})`)
  },

  /** `odb_audit.bulk(<json_array>)` */
  bulk(data: PlsqlRenderable): PlsqlStatement {
    return odbAuditPackage.bulk(data)
  },

  /** `odb_audit.purge(<older_than>)` */
  purge(olderThan: PlsqlRenderable): PlsqlStatement {
    return odbAuditPackage.purge(olderThan)
  },
}
