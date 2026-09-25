# Settings

`odbSettings` installs the `odb_settings` package, `odb_settings_store` for application settings, and `odb_secrets_store` for write-only secret verification. Non-secret settings are stored as plain text; secret values are encrypted at rest with AES-256. It is installed into your schema by a migration (it is not a native Oracle built-in).

Use it in migrations for two things:

- install or drop the stores and package with `toSQLUp()` and `toSQLDown()`
- read and write settings, or write and verify secrets, from your own package bodies

## Install In A Migration

```ts
import { defineMigration, odbSettings } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('20260802140000_settings', {
  schema: schemaName,
}).install(odbSettings)
```

`install()` calls `toSQLUp({ schema })`. By default it creates a random local development key in `APP_SETTINGS_MASTER_KEY_LOCAL` if one does not already exist. For OCI, install `odbSettings.vaultSecret(uri)` instead; see [The Master Key](#the-master-key).

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
import { odbLiteral, odbPackage, odbType } from '@odbvue/odb'

const appPackage = odbPackage('pck_app', (p) => {
  const configure = p.proc(
    'configure',
    { in: { apiKey: odbType.string() } },
    ({ params, body }) => {
      body.raw(
        odbSettings.write(odbLiteral('API_URL'), odbLiteral('https://api.example.com'), {
          name: odbLiteral('Api Url'),
        }),
      )
      body.raw(
        odbSettings.write(odbLiteral('API_KEY'), params.apiKey, {
          name: odbLiteral('Api Key'),
          secret: true,
        }),
      )
    },
  )

  p.func('api_url', 'VARCHAR2', (fn) => {
    fn.body((body) => body.return(odbSettings.read(odbLiteral('API_URL'))))
  })
})
```

## Expose Settings Services

The optional `odbSettingsApi` exposes authenticated ORDS procedures for reading and writing
regular and encrypted settings. Define the four services in an application migration and install
the API after `odbSettings` and `odbAuth` have been installed:

```ts
const readSetting = odbSettingsApi.procedure('readSetting')
defineService(readSetting, {
  method: 'GET',
  path: '/:id',
  headers: { Authorization: readSetting.parameters.authorization },
  uri: { id: readSetting.parameters.id },
  response: { value: readSetting.parameters.value },
})
// Bind writeSetting, readSecretSetting and writeSecretSetting in the same way.
export const migration = defineMigration('settings_api', { schema: schemaName }).install(
  odbSettingsApi,
)
```

The settings API uses `GET` and `PUT` under `/settings/:id` and `/settings/secret/:id`.
The regular read rejects encrypted values; the secret read rejects plain values. Both return
the value to authenticated callers, so restrict access to these routes as appropriate for your app.

## The Master Key

Secrets are encrypted with AES-256-CBC using a random IV per value. The single `odb_settings` package owns key retrieval, settings encryption, and write-only secret verification:

1. **Local development** — `odbSettings` generates a random key in `APP_SETTINGS_MASTER_KEY_LOCAL` on first install and reuses it on reinstall. This is a convenience mock, not a security boundary: the key lives in the same database as the ciphertext. Local Podman needs only the ADB-Free container.
2. **OCI** — `odbSettings.vaultSecret(uri)` fetches the key from OCI Vault with `DBMS_CLOUD` and the database resource principal. Set `ODBVUE_KMS_VAULT_SECRET_URI` to the Vault secret-bundle URI before building the bootstrap migration; no local key table is created.

`odbSettings.secretWrite(id, value)` and `odbSettings.secretMatches(id, value)` use the separate encrypted `odb_secrets_store` table, but do not expose a secret read operation. Both stores and the provider are installed by the same migration artifact.

The provider boundary is inside PL/SQL: local development reads the key from the database, while OCI retrieves it from Vault. Both paths feed the same `odb_settings` encryption and verification code. ADB-Free does not need or reach a local KMS container; other cloud dependencies, such as future object storage support, should be mocked at their PL/SQL provider boundary rather than by adding local network services. Unlike the local key, the OCI master key is not stored in the application schema. Configure OCI resource principal access and its IAM policies before using the Vault provider.

Do not switch providers or delete the local key table while you still need to decrypt existing secrets. The local key is removed when the bootstrap migration is rolled back.

## Expression Helpers

| Helper                                           | PL/SQL                        | Notes                                                    |
| ------------------------------------------------ | ----------------------------- | -------------------------------------------------------- |
| `read(id)`                                       | `odb_settings.read`           | `VARCHAR2` — decrypts secrets                            |
| `readRegular(id)`                                | `odb_settings.read_regular`   | Reads only plain settings                                |
| `readSecret(id)`                                 | `odb_settings.read_secret`    | Reads only encrypted settings                            |
| `write(id, value, { name?, options?, secret? })` | `odb_settings.write`          | Upsert; `name` defaults to `id`, `secret: true` encrypts |
| `remove(id)`                                     | `odb_settings.remove`         | Delete a setting                                         |
| `secretWrite(id, value)`                         | `odb_settings.secret_write`   | Encrypt and store a write-only secret                    |
| `secretMatches(id, value)`                       | `odb_settings.secret_matches` | Verify a secret without returning it                     |
| `seed(...settings)`                              | —                             | Migration artifact that upserts settings on `up`         |

Arguments are PL/SQL expressions — use `odbLiteral('KEY')` for a literal id/value and a bare string (e.g. `'p_api_key'`) for a variable.

## Notes

- Changing or losing the master key makes previously encrypted secrets unrecoverable.
- The `value` column is `VARCHAR2(2000)`; encrypted values are base64-encoded, so keep secrets well within that budget.
- `options` accepts JSON metadata (`IS JSON` constraint); `secret` is constrained to `Y` / `N`.
