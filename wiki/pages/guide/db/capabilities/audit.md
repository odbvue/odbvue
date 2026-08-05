# Audit

`odbAudit` exposes an odb framework package, `odb_audit`, plus an `odb_audit_logs` table for structured audit logging. It is installed into your schema by a migration (it is not a native Oracle built-in).

The table and package model an [OpenTelemetry LogRecord](https://opentelemetry.io/docs/specs/otel/logs/data-model/). It is **logs only** for now — there are no spans or traces yet, but the schema and attribute keys follow the OTel data model and semantic conventions so it can grow into them without breaking changes.

Use it in migrations for two things:

- install or drop the table and package with `toSQLUp()` and `toSQLDown()`
- call the logging helpers from your own package bodies

## Install In A Migration

```ts
import { defineMigration, odbAudit } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('20260802130000_audit', {
  schema: schemaName,
}).install(odbAudit)
```

## Write A Log Record

Each `debug` / `info` / `warn` / `error` / `fatal` call inserts one record in an autonomous transaction, so audit logging never rolls back with the caller. From a procedure body use the `body.audit*` helpers — the message is quoted for you, and attributes are a plain JSON object whose values are PL/SQL expressions:

```ts
import { odbPackage } from '@odbvue/odb'

const appPackage = odbPackage('pck_app', (p) => {
  p.proc('login', (proc) => {
    const uuid = proc.in('uuid', 'VARCHAR2')

    proc.body((body) => {
      body.auditEvent('user logged in', { 'user.id': 'p_uuid' })
    })
  })
})
```

The available body helpers are `auditDebug`, `auditInfo`, `auditWarn`, `auditError`, `auditFatal`, and `auditEvent` (an INFO-level alias). Attribute keys become OTel attribute names; values are emitted as-is, so pass a bare variable (`p_uuid`), a literal (`"'active'"`), or a nested call.

```ts
proc.body((body) => {
  body.auditWarn('rate limit near', { 'user.id': 'p_uuid', 'http.request.method': 'v_method' })
})
```

For full control over severity text and event time, call the package directly with `body.raw`:

```ts
proc.body((body) => {
  body.raw(odbAudit.log("'INFO'", "'job finished'", 'v_attributes', 'systimestamp'))
})
```

## The `odb_audit_logs` Table

| Column               | OTel field        | Notes                                                   |
| -------------------- | ----------------- | ------------------------------------------------------- |
| `id`                 | —                 | `CHAR(32)` primary key, `lower(sys_guid())`             |
| `observed_timestamp` | ObservedTimestamp | When the record was written                             |
| `event_timestamp`    | Timestamp         | When the event occurred                                 |
| `severity_number`    | SeverityNumber    | `NUMBER(2)` (`INFO` = 9, `ERROR` = 17, …)               |
| `severity_text`      | SeverityText      | `TRACE` / `DEBUG` / `INFO` / `WARN` / `ERROR` / `FATAL` |
| `body`               | Body              | Human-readable message                                  |
| `attributes`         | Attributes        | JSON (`IS JSON` constraint)                             |
| `service_name`       | —                 | Virtual, extracted from `attributes.service.name`       |
| `service_version`    | —                 | Virtual, extracted from `attributes.service.version`    |

The `log` procedure enriches `attributes` with OTel semantic-convention keys when available: `service.name`, `http.request.method`, `url.path`, `user_agent.original`, `client.address`, and `exception.message` / `exception.stacktrace` when called inside an exception handler.

## Expression Helpers

| Helper                                       | PL/SQL                      | Notes                                     |
| -------------------------------------------- | --------------------------- | ----------------------------------------- |
| `log(severity, body, attributes?, eventTs?)` | `odb_audit.log`             | Full control over severity and event time |
| `debug(body, attributes?)`                   | `odb_audit.debug`           | Logs at `DEBUG`                           |
| `info(body, attributes?)`                    | `odb_audit.info`            | Logs at `INFO`                            |
| `warn(body, attributes?)`                    | `odb_audit.warn`            | Logs at `WARN`                            |
| `error(body, attributes?)`                   | `odb_audit.error`           | Logs at `ERROR`                           |
| `fatal(body, attributes?)`                   | `odb_audit.fatal`           | Logs at `FATAL`                           |
| `severityNumber(severity)`                   | `odb_audit.severity_number` | `PLS_INTEGER` — OTel SeverityNumber       |
| `bulk(jsonArray)`                            | `odb_audit.bulk`            | Insert many records from a JSON array     |
| `purge(olderThan)`                           | `odb_audit.purge`           | Delete records before a cut-off timestamp |

## Notes

- Logging runs in an autonomous transaction — records persist even if the calling transaction rolls back.
- `severity_text` is constrained to the six OTel-style names; `severity_number` is derived automatically.
- No spans or traces yet. When they are added, `trace_id` / `span_id` columns can be introduced alongside the existing schema.
