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

## JWT

Sign and verify JSON Web Tokens (HS256). Backed by the odb framework package `odb_jwt`.

### Install

```ts
import { odbJwt } from '@odbvue/odb'

odbJwt.toSQLUp({ schema: 'APP_USER' })
odbJwt.toSQLDown({ schema: 'APP_USER' })
```

### Expression Helpers

```ts
odbJwt.encode('v_payload', 'v_secret')
odbJwt.verify('v_token', 'v_secret')
odbJwt.payload('v_token')
odbJwt.claim('v_token', "'sub'")
odbJwt.isExpired('v_token')
odbJwt.isExpired('v_token', '30')
odbJwt.base64urlEncode('v_text')
odbJwt.base64urlDecode('v_b64')
odbJwt.toEpoch()
odbJwt.fromEpoch('v_epoch')
```

### Example

```ts
pkg.proc('issue_token', { out: { token: odbType.string() } }, ({ params, body }) => {
  const { vPayload } = body.variables({ vPayload: odbType.string(2000) })
  body.raw(
    `${vPayload.name} := JSON_OBJECT('sub' VALUE 'u1', 'exp' VALUE odb_jwt.to_epoch() + 3600)`,
  )
  body.raw(`${params.token.name} := ${odbJwt.encode(vPayload.name, `'my-secret'`)}`)
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

See the [JWT capability page](./jwt) for details.

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
body.call(odbSettings.list(after, items)) // OUT SYS_REFCURSOR, 50 rows per page
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

`odbAuth` installs the `odb_auth` REST API, user and session tables, JWT support, and HTTP error helpers. It provides password login, refresh-token rotation through an `HttpOnly` cookie, logout, and the authenticated-user endpoint. See the [Authentication capability](./auth) for installation and client integration.
