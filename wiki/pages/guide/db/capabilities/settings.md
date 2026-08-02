# Settings

`odbSettings` exposes an odb framework package, `odb_settings`, plus an `odb_settings_store` table for application settings. Non-secret values are stored as plain text; secrets are encrypted at rest with AES-256. It is installed into your schema by a migration (it is not a native Oracle built-in).

Use it in migrations for two things:

- install or drop the table and package with `toSQLUp()` and `toSQLDown()`
- read and write settings from your own package bodies

## Install In A Migration

```ts
import { defineMigration, odbSettings } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('20260802140000_settings', {
  schema: schemaName,
}).install(odbSettings)
```

`install()` calls `toSQLUp({ schema })`, which bakes the fallback encryption key into the package body. That key defaults to a built-in development key and can be overridden with the `ODBVUE_SETTINGS_MASTER_KEY` environment variable or by passing `{ masterKey }` to `toSQLUp`. In production, prefer OCI Vault (see below) so the baked key is never the one in effect.

## Seed Settings

`odbSettings.seed(...)` builds a migration artifact that upserts one or more settings through the package's `write`. It is schema-aware (qualifies `odb_settings` with the migration schema), so it works even when migrations run as a different user such as `ADMIN`. Install it **after** `odbSettings` so the package exists:

```ts
export const migration = defineMigration('20260802140000_settings', {
  schema: schemaName,
})
  .install(odbSettings)
  .install(odbSettings.seed({ id: 'APP_VERSION', name: 'Application version', value: '1.0.0' }))
```

String fields are plain text (quoted for you). Pass `secret: true` to store the value encrypted, and `options` for JSON metadata. `seed` accepts multiple settings; `up` upserts each one and `down` removes them:

```ts
odbSettings.seed(
  { id: 'API_URL', name: 'Api Url', value: 'https://api.example.com' },
  { id: 'API_KEY', name: 'Api Key', value: 'super-secret', secret: true },
)
```

## Read And Write Settings

`write` upserts a setting; pass `p_secret = 'Y'` to encrypt the value. `read` returns the value, transparently decrypting secrets:

```ts
import { odbLiteral, odbPackage } from '@odbvue/odb'

const appPackage = odbPackage('pck_app', (p) => {
  p.procedure('configure', (proc) => {
    const apiKey = proc.in('api_key', 'VARCHAR2')

    proc.body((body) => {
      body.raw(
        odbSettings.write(odbLiteral('API_URL'), odbLiteral('https://api.example.com'), {
          name: odbLiteral('Api Url'),
        }),
      )
      body.raw(
        odbSettings.write(odbLiteral('API_KEY'), 'p_api_key', {
          name: odbLiteral('Api Key'),
          secret: true,
        }),
      )
    })
  })

  p.func('api_url', 'VARCHAR2', (fn) => {
    fn.body((body) => body.return(odbSettings.read(odbLiteral('API_URL'))))
  })
})
```

## The Master Key

Secrets are encrypted with AES-256-CBC using a random IV per value. The package resolves the master key at instantiation in two steps:

1. **OCI Vault** — if an `ODB_SETTINGS_MASTER_KEY_URI` setting points at a secret bundle, the key is fetched from OCI Vault using the database's resource principal. This call is made through dynamic SQL, so the package still compiles where `DBMS_CLOUD` is unavailable (e.g. a local Oracle container).
2. **Fallback** — otherwise the key baked into the package body at install time is used. It defaults to a built-in development key (a shared default, like `INITIAL_PASSWORD`); override it with `ODBVUE_SETTINGS_MASTER_KEY` or the `masterKey` option for anything beyond local development.

To use OCI Vault, store the secret-bundle URI as a setting before the package first resolves its key:

```ts
odbSettings.write(odbLiteral('ODB_SETTINGS_MASTER_KEY_URI'), odbLiteral('https://vaults...'), {
  name: odbLiteral('Master Key URI'),
})
```

## Expression Helpers

| Helper                                           | PL/SQL                | Notes                                                    |
| ------------------------------------------------ | --------------------- | -------------------------------------------------------- |
| `read(id)`                                       | `odb_settings.read`   | `VARCHAR2` — decrypts secrets                            |
| `write(id, value, { name?, options?, secret? })` | `odb_settings.write`  | Upsert; `name` defaults to `id`, `secret: true` encrypts |
| `remove(id)`                                     | `odb_settings.remove` | Delete a setting                                         |
| `seed(...settings)`                              | —                     | Migration artifact that upserts settings on `up`         |

Arguments are PL/SQL expressions — use `odbLiteral('KEY')` for a literal id/value and a bare string (e.g. `'p_api_key'`) for a variable.

## Notes

- The `ODBVUE_SETTINGS_MASTER_KEY` value overrides the built-in default; when you set it, keep it out of source control. Changing the key makes secrets encrypted with the previous key unrecoverable.
- The `value` column is `VARCHAR2(2000)`; encrypted values are base64-encoded, so keep secrets well within that budget.
- `options` accepts JSON metadata (`IS JSON` constraint); `secret` is constrained to `Y` / `N`.
