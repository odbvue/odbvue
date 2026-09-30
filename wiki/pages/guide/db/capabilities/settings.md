# Settings

Settings is a key/value store defined in TypeScript. `odbSettings` installs the `odb_settings_store` table and the `odb_settings` PL/SQL package, which provides `list`, `read`, `write`, and `remove`. The package has no ORDS routes and does no authorization; an application package exposes it and decides who may call it.

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

`seed` upserts each setting through `odb_settings.write` and removes it on rollback. `odbSettings` requires the `odbHttp` helper, which supplies the 404 response raised by `read`.

## Procedures

| Procedure | Parameters                                  | Behavior                                                                                                             |
| --------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `list`    | `p_after` IN, `p_limit` IN, `p_items` OUT `SYS_REFCURSOR` | Up to `p_limit` rows (`NULL` = 50) ordered by `id`, starting after `p_after` (`NULL` for the first page). Columns: `id`, `value`, `meta`. |
| `read`    | `p_id` IN, `p_value` OUT, `p_meta` OUT      | Returns one setting; responds `404 NOT_FOUND` if it does not exist.                                                  |
| `write`   | `p_id`, `p_value`, `p_meta` IN              | Creates or updates a setting. A `NULL` `p_meta` keeps existing metadata (`{}` on create).                            |
| `remove`  | `p_id` IN                                   | Deletes a setting.                                                                                                   |

`meta` is free-form JSON text for presentation or validation hints (label, type, and so on); the package stores it without interpreting it. Values are stored as text up to 2000 characters.

## Expose Settings Over ORDS

Call the package from an application package and attach an explicit service contract. Authorize in the wrapper:

```ts
import { defineService, odbAuth, odbPackage, odbSettings, odbType } from '@odbvue/odb'

const api = odbPackage('pck_app_api', (pkg) => {
  const readSetting = pkg.proc(
    'read_setting',
    {
      in: { authorization: odbType.string(4000), id: odbType.string(128) },
      out: { value: odbType.string(2000), meta: odbType.string(2000) },
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
