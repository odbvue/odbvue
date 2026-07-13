# API Reference

## LOB

Package for LOB processing and Base64 conversion. Backed by the Oracle package `pck_api_lob`.

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
