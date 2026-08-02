# LOB

`odbLob` exposes an odb framework package, `odb_lob`, for common LOB and Base64 conversions. It is installed into your schema by a migration (it is not a native Oracle built-in).

Use it in migrations for two things:

- install or drop the database package with `toSQLUp()` and `toSQLDown()`
- provide typed conversion methods such as `toBase64()` on local variables

## Install In A Migration

```ts
import { defineMigration, odbLob } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('20260628161706_test', {
  schema: schemaName,
}).install(odbLob)
```

## Use In A Procedure Body

```ts
import { odbPackage } from '@odbvue/odb'

const appPackage = odbPackage('pck_app', (p) => {
  p.procedure('version', (proc) => {
    const test = proc.out('test', 'CLOB')

    proc.body((body) => {
      const vVersion = body.varchar2('v_version', 200).value('1.0.1')
      body.set(test, vVersion.toBase64())
    })
  })
})
```

## Typed Variables

Capture parameter and variable handles, then use `body.set()` for compile-time type checking.
Local variables expose convenience methods based on their PL/SQL type:

```ts
const textResult = proc.out('text_result', 'CLOB')
const clobResult = proc.out('clob_result', 'CLOB')

proc.body((body) => {
  const vText = body.varchar2('v_text', 200).value('hello')
  const vClob = body.variable('v_clob', 'CLOB').assign('empty_clob()')

  body.set(textResult, vText.toBase64())
  body.set(clobResult, vClob.toBase64())
})
```

Use `body.assign()` and the functional `odbLob` helpers only as escape hatches for raw PL/SQL expressions.

Supported typed helpers:

- `VARCHAR2` -> `toBase64()`
- `CLOB` -> `toBase64()`, `toBlob()`
- `BLOB` -> `toBase64()`, `toClob()`
