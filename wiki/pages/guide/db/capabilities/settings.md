# Settings

Settings is a key/value store defined in TypeScript. `odbSettings` installs the `odb_settings_store` table and the `odb_settings` PL/SQL package, which provides `list`, `read`, `write`, and `remove`. The package has no ORDS routes and does no authorization; an application package exposes it and decides who may call it.

## Capability vs service

`odbSettings` is a database capability, not an HTTP service.

It owns:

- settings storage;
- database operations such as `list`, `read`, `write`, and `remove`;
- setting types and metadata;
- standard ODB errors.

The application owns:

- which operations are exposed;
- authorization;
- HTTP routes and methods;
- request and response shapes;
- pagination representation.

For example, an application may expose `odbSettings.read()` through ORDS, use it from another PL/SQL package, or keep it entirely internal.

## Install And Seed

```ts
import { defineMigration, odbSettings } from '@odbvue/odb'

export const migration = defineMigration('20260802140000_settings', {
  schema: process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? '',
})
  .install(odbSettings)
  .install(
    odbSettings.seed({
      id: 'PASSWORD_MIN_LENGTH',
      value: '8',
      meta: { label: 'Minimum password length', type: 'number' },
    }),
  )
```

`seed` upserts each setting through `odb_settings.write` and removes it on rollback.

`odbSettings` is transport-independent. It provides database operations and raises standard ODB errors such as `NOT_FOUND`.

HTTP exposure, authorization, and mapping ODB errors to HTTP responses belong to the application service.

## Procedures

| Procedure | Parameters                                                | Behavior                                                                                                                                                                                                  |
| --------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`    | `p_after` IN, `p_limit` IN, `p_items` OUT `SYS_REFCURSOR` | Up to `p_limit` rows (`NULL` = 50) ordered by `id`, starting after `p_after` (`NULL` for the first page). Columns: `id`, `value`, `meta`. Callers detect a further page by requesting `p_limit + 1` rows. |
| `read`    | `p_id` IN, `p_value` OUT, `p_meta` OUT                    | Reads one setting; raises the ODB `NOT_FOUND` error if it does not exist.                                                                                                                                 |
| `write`   | `p_id`, `p_value`, `p_meta` IN                            | Creates or updates a setting. A `NULL` `p_meta` keeps existing metadata (`{}` on create).                                                                                                                 |
| `remove`  | `p_id` IN                                                 | Deletes a setting.                                                                                                                                                                                        |

`meta` is free-form JSON text for presentation or validation hints (label, type, and so on); the package stores it without interpreting it. Values are stored as text up to 2000 characters.

### `read`

Reads a setting by ID.

If the setting does not exist, `read` raises the standard ODB `NOT_FOUND` error. The caller decides how that error is exposed; for example, an ORDS service may map it to HTTP 404.

### `list`

Settings uses database-native keyset pagination:

```ts
odbSettings.list(after, limit, items)
```

- `after` is the last setting ID from the previous page.
- `limit` controls the maximum number of rows returned.
- `items` is the result set.

The capability does not define HTTP pagination semantics such as query parameters or opaque cursors. Application services may translate their public pagination contract into `after` and `limit`.

Requesting one extra row lets the application determine whether another page exists:

```ts
const pageSize = 10

body.call(odbSettings.list(after, pageSize + 1, items))
```

If more than `pageSize` rows come back, the application returns the first `pageSize` rows and uses the last returned ID as the next `after`.

## Expose Settings Over ORDS

Call the package from an application package and attach an explicit service contract. Authorize in the wrapper:

```ts
import { defineService, odbAuth, odbPackage, odbSettings, odbType } from '@odbvue/odb'

const api = odbPackage('pck_app_api', (pkg) => {
  const readSetting = pkg.proc(
    'read_setting',
    {
      in: { authorization: odbType.string(4000), id: odbSettings.types.id },
      out: { value: odbSettings.types.value, meta: odbSettings.types.meta },
    },
    ({ params: { authorization, id, value, meta }, body }) => {
      const { subject } = body.variables({ subject: odbType.guid() })
      body.set(subject, odbAuth.requireUser(authorization))
      body.call(odbSettings.read(id, value, meta))
    },
  )

  defineService(readSetting, {
    method: 'GET',
    path: '/settings/:id',
    headers: { Authorization: readSetting.parameters.authorization },
    uri: { id: readSetting.parameters.id },
    response: { value: readSetting.parameters.value, meta: readSetting.parameters.meta },
  })
})
```

Reuse the exported capability types instead of redeclaring them. `value: odbSettings.types.value` preserves JSON typing, sizes, and future changes to the capability contract; `value: odbType.string(2000)` does not.

The sandbox migration (`apps/db/src/migrations/00000000000001-sandbox.ts`) shows the full set of `list`, `read`, `write`, and `remove` services in one `pck_sandbox` package.

## Calling From PL/SQL

The `odbSettings` helpers return typed calls for `body.call(...)`:

```ts
body.call(odbSettings.write(id, value)) // keeps existing meta
body.call(odbSettings.write(id, value, metaJson))
body.call(odbSettings.list(after, limit, items)) // limit NULL = default 50
body.call(odbSettings.remove(id))
```

Transactions belong to the caller; ORDS commits after a successful handler.

## Limits

Secret (encrypted) settings are not part of this package. Do not store secrets in `value` until an encryption provider is added.

The table layout differs from earlier Settings versions (`id`, `value`, `meta`). Existing deployments need an explicit data migration; editing an applied bootstrap migration does not migrate an existing table.
