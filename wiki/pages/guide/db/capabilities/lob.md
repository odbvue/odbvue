# LOB

`odbLob` exposes a pre-installed Oracle package, `pck_api_lob`, for common LOB and Base64 conversions.

Use it in migrations for two things:

- install or drop the database package with `toSQLUp()` and `toSQLDown()`
- generate PL/SQL expressions such as `clobToBase64()` inside package bodies

## Install In A Migration

```ts
import { defineMigration, odbLob } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('20260628161706_test', '1.0.1')
  .up(() => [odbLob.toSQLUp({ schema: schemaName })])
  .down(() => [odbLob.toSQLDown({ schema: schemaName })])
```

## Use In A Procedure Body

```ts
import { odbLob, odbPackage } from '@odbvue/odb'

const appPackage = odbPackage('pck_app', (p) => {
  p.procedure('version', (proc) => {
    proc.out('test', 'CLOB')
    proc.body((body) => {
      const vVersion = body.variable('v_version', 'VARCHAR2', 200).assign("'1.0.1'")
      body.assign('test', odbLob.varchar2ToBase64(vVersion.name))
    })
  })
})
```

## Typed Variables

Some local variables expose convenience methods based on their PL/SQL type:

```ts
proc.body((body) => {
  const vText = body.variable('v_text', 'VARCHAR2', 200).assign("'hello'")
  const vClob = body.variable('v_clob', 'CLOB').assign('empty_clob()')

  body.assign('out_b64_from_text', vText.toBase64())
  body.assign('out_b64_from_clob', vClob.toBase64())
})
```

Supported typed helpers:

- `VARCHAR2` -> `toBase64()`
- `CLOB` -> `toBase64()`, `toBlob()`
- `BLOB` -> `toBase64()`, `toClob()`
