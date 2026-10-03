# API Reference

## LOB

Package for LOB processing and Base64 conversion. Backed by the odb framework package `odb_lob`.

### Install

```ts
import { odbLob } from '@odbvue/odb'

odbLob.toSQLUp({ schema: 'APP_USER' })
odbLob.toSQLDown({ schema: 'APP_USER' })
```

### Expression Helpers

```ts
odbLob.clobToBlob('v_clob')
odbLob.blobToClob('v_blob')
odbLob.blobToBase64('v_blob')
odbLob.clobToBase64('v_clob')
odbLob.varchar2ToBase64('v_text')
odbLob.base64ToBlob('v_b64')
odbLob.base64ToClob('v_b64')
odbLob.base64ToVarchar2('v_b64')
```

### Example

```ts
pkg.proc('encode', { out: { result: odbType.clob() } }, ({ params, body }) => {
  const { vText } = body.variables({ vText: odbType.string(200) })
  body.set(vText, 'hello')
  body.set(params.result, vText.toBase64())
})
```

## Audit

OpenTelemetry-aligned audit logging (logs only). Backed by the odb framework package `odb_audit` and the `odb_audit_logs` table.

### Install

```ts
import { odbAudit } from '@odbvue/odb'

odbAudit.toSQLUp({ schema: 'APP_USER' })
odbAudit.toSQLDown({ schema: 'APP_USER' })
```

### Expression Helpers

```ts
odbAudit.log("'INFO'", "'started'")
odbAudit.log("'INFO'", "'started'", 'v_attributes', 'systimestamp')
odbAudit.debug("'msg'")
odbAudit.info("'msg'", 'v_attributes')
odbAudit.warn("'msg'")
odbAudit.error("'msg'", 'v_attributes')
odbAudit.fatal("'msg'")
odbAudit.severityNumber("'WARN'")
odbAudit.bulk('v_json_array')
odbAudit.purge('v_cutoff')
```

### Example

```ts
pkg.proc('log_event', {}, ({ body }) => {
  body.auditEvent('user logged in', { 'user.id': 'p_uuid' })
})
```

## Settings

Settings store defined in TypeScript: the `odb_settings_store` table and the `odb_settings` PL/SQL package (`list`, `read`, `write`, `remove`). See the [Settings guide](./settings) for details.

### Install

```ts
import { odbSettings } from '@odbvue/odb'

odbSettings.toSQLUp({ schema: 'APP_USER' })
odbSettings.toSQLDown({ schema: 'APP_USER' })
```

### Calling the package

Each helper returns a typed call to `odb_settings`, for use with `body.call(...)`:

```ts
body.call(odbSettings.read(id, value, meta)) // OUT value, meta
body.call(odbSettings.write(id, value)) // upsert, keeps existing meta
body.call(odbSettings.list(after, limit, items)) // OUT SYS_REFCURSOR; limit NULL = 50 rows
body.call(odbSettings.remove(id))
```

### Seed

Schema-aware migration artifact that upserts settings through `odb_settings.write` (install after `odbSettings`):

```ts
odbSettings.seed({ id: 'APP_VERSION', value: '1.0.0', meta: { label: 'Application version' } })
```

## ORDS Services

Declare a procedure and its implementation with `proc()`, then attach its explicit HTTP contract with `defineService()`:

```ts
import { defineService, odbPackage, odbType } from '@odbvue/odb'

const api = odbPackage('pck_api', (pkg) => {
  const version = pkg.proc('version', { out: { version: odbType.string() } }, ({ params, body }) =>
    body.set(params.version, '1.0.1'),
  )

  defineService(version, {
    auth: 'anonymous',
    method: 'GET',
    path: '/version',
    summary: 'Returns the application version',
    response: { version: version.parameters.version },
  })
})
```

Direct bindings map public HTTP names to typed procedure parameters. Bind every parameter exactly once: `body` and `uri` accept `in`/`inOut` parameters, `response` accepts `out`/`inOut`, and `headers` accepts either direction. Optional `module`, `basePath`, and `paramTypes` properties override derived ORDS configuration. `defineService()` stores metadata in the application contract used by ORDS, client, and OpenAPI generators.

For example, a POST request body is explicit: `body: { username: procedure.parameters.username }`. Use `headers` and `uri` for their respective transports.

## Authentication

`odbAuth` installs the `odb_auth` PL/SQL package, user and session tables, and JWT support. It provides `login`, `refresh`, `logout`, `read_user`, and `require_user` as transport-independent database operations; the application package exposes them over HTTP and owns headers, cookies, and routes. See the [Authentication capability](./auth) for installation and client integration.
