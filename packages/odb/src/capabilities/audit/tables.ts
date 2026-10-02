import { odbTable } from '../../schema/table.js'
import {
  BODY_LENGTH,
  SERVICE_ATTRIBUTE_LENGTH,
  SEVERITY_NUMBERS,
  SEVERITY_TEXT_LENGTH,
  SEVERITY_TEXTS,
} from './constants.js'

function serviceAttribute(key: string): string {
  return `JSON_VALUE(attributes FORMAT JSON, '$."${key}"' RETURNING VARCHAR2(${SERVICE_ATTRIBUTE_LENGTH}) NULL ON ERROR)`
}

/** OpenTelemetry LogRecord store. Logs only — no spans or traces. */
export const auditLogs = odbTable('odb_audit_logs', (t) => ({
  id: t.guid().primaryKey().defaultSysGuid(),
  observedTimestamp: t.timestamp().notNull().defaultSysTimestamp(),
  eventTimestamp: t.timestamp().notNull().defaultSysTimestamp(),
  severityNumber: t.number().precision(2).notNull().default(SEVERITY_NUMBERS.INFO),
  severityText: t.string(SEVERITY_TEXT_LENGTH).notNull().default('INFO'),
  body: t.string(BODY_LENGTH).notNull(),
  attributes: t.json(),
  serviceName: t.string(SERVICE_ATTRIBUTE_LENGTH).generatedAs(serviceAttribute('service.name')),
  serviceVersion: t
    .string(SERVICE_ATTRIBUTE_LENGTH)
    .generatedAs(serviceAttribute('service.version')),
}))
  .check('odb_audit_logs_chk_severity', (columns, expression) =>
    expression.in(columns.severityText, SEVERITY_TEXTS),
  )
  .index('odb_audit_logs_ix_event', (columns) => [columns.eventTimestamp])
  .comment('OpenTelemetry-aligned audit logs')
