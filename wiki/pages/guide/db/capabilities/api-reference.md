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
const result = proc.out('p_result', 'CLOB')

proc.body((body) => {
  const vText = body.varchar2('v_text', 200).value('hello')
  body.set(result, vText.toBase64())
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
const token = proc.out('p_token', 'VARCHAR2')

proc.body((body) => {
  const vPayload = body
    .varchar2('v_payload', 2000)
    .assign(`JSON_OBJECT('sub' VALUE 'u1', 'exp' VALUE odb_jwt.to_epoch() + 3600)`)
  body.set(token, odbJwt.encode('v_payload', `'my-secret'`))
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
proc.body((body) => {
  body.auditEvent('user logged in', { 'user.id': 'p_uuid' })
})
```

See the [JWT capability page](./jwt) for details.

## Settings

Key/value settings store with AES-256 encryption for secrets. Backed by the odb framework package `odb_settings` and the `odb_settings_store` table.

### Install

```ts
import { odbSettings } from '@odbvue/odb'

// Fallback key defaults to a built-in dev key; override via ODBVUE_SETTINGS_MASTER_KEY
odbSettings.toSQLUp({ schema: 'APP_USER' })
odbSettings.toSQLDown({ schema: 'APP_USER' })
```

### Expression Helpers

```ts
odbSettings.read(odbLiteral('API_URL'))
odbSettings.write(odbLiteral('API_URL'), 'v_url', { name: odbLiteral('Api Url') })
odbSettings.write(odbLiteral('API_KEY'), 'v_key', { secret: true }) // encrypted at rest
odbSettings.remove(odbLiteral('API_URL'))
```

### Seed

Schema-aware migration artifact that upserts settings (install after `odbSettings`):

```ts
odbSettings.seed({ id: 'APP_VERSION', name: 'Application version', value: '1.0.0' })
```

### Example

```ts
const url = proc.out('p_url', 'VARCHAR2')

proc.body((body) => {
  body.set(url, odbSettings.read(odbLiteral('API_URL')))
})
```

## ORDS Services

Expose a package procedure with an explicit HTTP contract:

```ts
proc.service({
  method: 'GET',
  path: '/version',
  summary: 'Returns the application version',
})
```

Optional `module`, `basePath`, and `paramTypes` properties override derived ORDS configuration. The lower-level `proc.ords()` builder remains available for convention-based endpoints.
