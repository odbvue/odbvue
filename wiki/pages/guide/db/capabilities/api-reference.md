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
  const vPayload = body.varchar2('v_payload', 2000).assign(
    `JSON_OBJECT('sub' VALUE 'u1', 'exp' VALUE odb_jwt.to_epoch() + 3600)`,
  )
  body.set(token, odbJwt.encode('v_payload', `'my-secret'`))
})
```

See the [JWT capability page](./jwt) for details.

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
