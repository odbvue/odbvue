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
import { odbPackage, odbType } from '@odbvue/odb'

const appPackage = odbPackage('pck_app', (p) => {
  const login = p.proc('login', { in: { uuid: odbType.string() } }, ({ params, body }) => {
    body.auditEvent('user logged in', { 'user.id': params.uuid })
  })
})
```

The available body helpers are `auditDebug`, `auditInfo`, `auditWarn`, `auditError`, `auditFatal`, and `auditEvent` (an INFO-level alias). Attribute keys become OTel attribute names; values are emitted as-is, so pass a bare variable (`p_uuid`), a literal (`"'active'"`), or a nested call.

```ts
// Inside a proc() callback, `body` is the statement builder:
body.auditWarn('rate limit near', { 'user.id': 'p_uuid', 'http.request.method': 'v_method' })
```

For full control over severity text and event time, call the package directly with `body.raw`:

```ts
// Inside a proc() callback, `body` is the statement builder:
body.raw(odbAudit.log("'INFO'", "'job finished'", 'v_attributes', 'SYS_EXTRACT_UTC(SYSTIMESTAMP)'))
```

Explicit event timestamps, including bulk records, must represent UTC instants.

## The `odb_audit_logs` Table

`odbAudit.list(after, limit, items)` uses a decoded timestamp/ID cursor tuple,
ordered newest first with an ID tie-breaker. It fetches the displayed limit plus
one lookahead row. Delegating services automatically return `{ items, nextCursor? }`;
clients request the displayed size and forward opaque tokens unchanged. The
tuple carries timestamp precision directly, so pagination does not require the
previous audit record to still exist. Shared defaults are 25/100, with optional
package or service `pagination` overrides.

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

## User Activity

Generated `defineService` handlers automatically audit exceptions that result in
HTTP 5xx responses, for reads as well as mutations. The final exception handler
records an ERROR with a readable procedure name (for example, `Refresh failed`),
the event type (`auth.refresh`), HTTP method and status, and the Oracle backtrace
in `exception.stacktrace`. Records include the server-verified `user.id` when
available. The handler does not attach request or response payloads, and the
backtrace stays in audit details rather than in the HTTP response. Install
`odbAudit` before the API packages.

Authentication also records user-linked domain events after resolving the account:
login (including Google, LDAP, and completed two-factor verification), logout,
refresh, signup/confirmation, password recovery/reset, and Google identity linking.
An unresolved anonymous request is not attributed to an arbitrary user.
Anonymous recovery/signup requests use `target.user.id` rather than claiming the
requester is authenticated. Admin status and role changes include both the actor
and affected user.

Successes and expected rejections (4xx) are business decisions: procedures use
the `body.audit*` helpers to log the events that matter. For example, a successful
refresh emits the user-linked `Session refreshed` event, and a sign-out that
does not match an unrevoked session emits no success event. Existing audit rows
are not changed.

`user_id`, `target_user_id`, and `event_name` are generated projections of JSON
attributes, not additional OTel LogRecord fields. User/time indexes accelerate
activity queries; JSON remains their source of truth. `target.user.id` and
`event.outcome` are application conventions, not claims of standardized OTel
semantic keys. `event.name` is the application's message-type attribute; an OTLP
exporter would map it to the LogRecord EventName field. These storage projections
do not change the OTel logical data model.

The admin user's Audit tab lists events performed by or affecting that account,
newest first. `GET /admin/users/:id/audit` is admin-only and filters in SQL before
cursor pagination. It accepts `severity` (comma-separated INFO/WARN/ERROR),
`messageType` (case-insensitive event-name substring), `search` (message substring),
and inclusive `from`/`to` UTC timestamps in `YYYY-MM-DDTHH:mm:ss.SSSZ` format.
Invalid severities, timestamps and reversed intervals return 422.
The table forwards opaque `cursor` tokens and `{ items, nextCursor }` unchanged.

The standalone **Admin → Audit** page uses `GET /admin/audit/events` to list all
events with the same filters and cursor pagination. It shows the actor's username
and display name, falling back to the affected account when the actor cannot be
resolved. Events without a matching account are still listed. The user autocomplete
searches by username or display name; selecting a user filters for both actions
they performed and actions that affected them.

Service outcome records and domain events describe different layers. As with all
audit calls, they survive a later caller rollback; a successful procedure call is
not proof that an enclosing transaction was eventually committed.

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
