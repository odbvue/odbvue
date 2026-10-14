# API Reference

## Network ACL

`odbAcl` provides `addHttp(host, port?)`, `removeHttp(host, port?)`,
`addSmtp(host, port?)`, `removeSmtp(host, port?)`, and `list(items)` for the
application schema. Default exact ports are 443 and 587; only `http` or `smtp`
is granted. See the [Network ACL guide](./acl) for schema provisioning prerequisites,
typed calls, and sandbox services.

## Emails

`odbEmails` installs SMTP delivery, queued messages, recipient addresses and
storage-backed attachments. See the [Emails guide](./emails) for SMTP settings,
transaction boundaries, typed calls, and sandbox services.
Bootstrap leaves `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`,
`SMTP_FROM_ADDR`, and `SMTP_FROM_NAME` empty. Run `ov setup-settings` (alias `ov ss`)
after deployment to fill them and update the SMTP host ACL. The command also
provisions [JWT settings](./auth#jwt-configuration) and `APP_PUBLIC_URL` for signup
confirmation emails; `ov setup settings` is equivalent. The application URL can
be imported using the case-insensitive `app_public_url` JSON key or entered at
the prompt (development default `http://localhost:5173/`).
`SMTP_PASSWORD` is encrypted and masked by [Settings](./settings); configure its
master-key provider before running the command.

## DBMS_CLOUD

`odbDbmsCloud` wraps Oracle's cloud HTTP request API:

- `response`: the `DBMS_CLOUD_TYPES.resp` record descriptor for `body.variables`.
- `METHOD_GET`: the Oracle method constant.
- `sendRequest(credentialName, uri, method?)`: typed response expression; defaults to GET.
- `getResponseStatusCode(response)`: numeric HTTP status.
- `getResponseText(response)`: CLOB response body.

These wrappers render calls; they do not install Oracle cloud packages or credentials.
Direct calls require those packages at compilation time. Use
`body.executeImmediate(build, bindings)` to generate a dynamic anonymous block
with isolated declarations and ordered `IN`, `OUT`, or `IN OUT` bindings when
cloud support is optional. The [Settings provider](./settings) uses this path
to support generated local keys when no Vault URI is configured.

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

Secret values must not be embedded in migrations: `seed` rejects non-empty values
with `meta.secret: 'Y'`. Owning capabilities declare secret metadata; Settings
does not recognize credential IDs. Existing secrets cannot be downgraded by `write`.
Use `value: ''` for secret placeholders, then supply credentials after deployment
through bind variables (for SMTP, use `ov setup-settings`). Validation runs at seed
creation and again before SQL generation.

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

`responseStatus` declares a successful HTTP status from 200 through 399
(default 200) in both the generated ORDS handler and OpenAPI. A redirect
procedure can use `responseStatus: 303` and an OUT `Location` header; error
translation still determines the status when the procedure raises.

## Authentication

`odbAuth` installs the `odb_auth` PL/SQL package, user and session tables, and JWT support. It provides `login`, `refresh`, `logout`, `read_user`, and `require_user` as transport-independent database operations; the application package exposes them over HTTP and owns headers, cookies, and routes. See the [Authentication capability](./auth) for installation and client integration.

## Google OpenID Connect

Install `odbGoogle` after `odbAuth` and `odbSettings`, then install
`odbGoogle.seedSettings()` to create missing, disabled-by-default provider
configuration. Its `enabled()`, `publicUrl()`, `start(returnPath, authorizationUrl, browserToken)`,
and `complete(state, code, browserToken, providerError, refreshToken, returnPath, outcome)`
helpers build calls into the transport-independent `odb_google` package.
`publicUrl()` reads and validates `APP_PUBLIC_URL`. The `start` and `complete`
primitives enforce attempt throttling for direct PL/SQL callers as well as HTTP
requests. The application owns Origin checks, cookies, callback routes,
redirects, and mapping business errors to UI outcomes.

`odbAuth.loginGoogle(subject, email, displayName, accessToken, refreshToken)`
is a **trusted server-only** identity/session primitive, not a public login
endpoint. Only call it after provider-token and transaction verification.
It creates no local password, grants no roles, and rejects email-based account
merges. See [Google sign-in](./auth#google-sign-in) for provisioning, security
policy, and manual deployment requirements.
