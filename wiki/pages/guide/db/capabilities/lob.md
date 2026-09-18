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
import { odbPackage, odbType } from '@odbvue/odb'

const appPackage = odbPackage('pck_app', (p) => {
  const version = p.proc('version', { out: { test: odbType.clob() } }, ({ params, body }) => {
    const { vVersion } = body.variables({ vVersion: odbType.string(200) })
    body.set(vVersion, '1.0.1')
    body.set(params.test, vVersion.toBase64())
  })
})
```

## Typed Variables

Capture parameter and variable handles, then use `body.set()` for compile-time type checking.
Local variables expose convenience methods based on their PL/SQL type:

```ts
const convert = pkg.proc(
  'convert',
  { out: { textResult: odbType.clob(), clobResult: odbType.clob() } },
  ({ params, body }) => {
    const { vText, vClob } = body.variables({
      vText: odbType.string(200),
      vClob: odbType.clob(),
    })
    body.set(vText, 'hello')
    body.raw(`${vClob.name} := empty_clob()`)

    body.set(params.textResult, vText.toBase64())
    body.set(params.clobResult, vClob.toBase64())
  },
)
```

Use `body.raw()` only as an escape hatch for raw PL/SQL statements.

Supported typed helpers:

- `VARCHAR2` -> `toBase64()`
- `CLOB` -> `toBase64()`, `toBlob()`
- `BLOB` -> `toBase64()`, `toClob()`
