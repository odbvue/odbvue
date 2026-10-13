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

Do not use `odbSettings.seed()` to embed non-empty secret values in migrations.
It rejects any non-empty `value` when `meta.secret` is `'Y'`, or when the ID is
`SMTP_PASSWORD` (which is always secret), both at seed creation and SQL generation.
Encryption during `write` does not protect plaintext literals in source or generated SQL.
Seed an empty placeholder instead:

```ts
odbSettings.seed({ id: 'SMTP_PASSWORD', value: '', meta: { secret: 'Y' } })
```

Supply actual credentials after deployment through bind variables, as
`ov setup-settings` does for SMTP credentials. Never put credentials in migration literals.

`odbSettings` is transport-independent. It provides database operations and raises standard ODB errors such as `NOT_FOUND`.

HTTP exposure, authorization, and mapping ODB errors to HTTP responses belong to the application service.

## Procedures

| Procedure     | Parameters                                                | Behavior                                                                                                                                                                                                  |
| ------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`        | `p_after` IN, `p_limit` IN, `p_items` OUT `SYS_REFCURSOR` | Up to `p_limit` rows (`NULL` = 50) ordered by `id`, starting after `p_after` (`NULL` for the first page). Columns: `id`, `value`, `meta`. Callers detect a further page by requesting `p_limit + 1` rows. |
| `read`        | `p_id` IN, `p_value` OUT, `p_meta` OUT                    | Reads one setting, decrypting secrets; raises the ODB `NOT_FOUND` error if it does not exist.                                                                                                             |
| `read_masked` | `p_id` IN, `p_value` OUT, `p_meta` OUT                    | Reads one setting, returning `********` for secrets without loading the key.                                                                                                                              |
| `write`       | `p_id`, `p_value`, `p_meta` IN                            | Creates or updates a setting. A `NULL` `p_meta` keeps existing metadata (`{}` on create).                                                                                                                 |
| `remove`      | `p_id` IN                                                 | Deletes a setting.                                                                                                                                                                                        |

`meta` is JSON text for presentation or validation hints (label, type, and so on).
`meta.secret` is reserved: `'Y'` marks an encrypted secret; omitted, `null`, or
`'N'` means ordinary configuration. The table exposes this flag as a virtual
`secret` column. Plaintext input is limited to 2000 characters. The stored `value`
is a CLOB so encrypted UTF-8 values can grow without truncation.
Both the write-path lookup and virtual column use `NULL ON EMPTY` with
`ERROR ON ERROR`: an omitted flag defaults to `'N'`, but malformed/non-scalar
flag values are not silently treated as ordinary configuration.

`SMTP_PASSWORD` is always marked secret, including when recreated after deletion.
The CLI seeds/writes its metadata explicitly. `SMTP_USERNAME` remains ordinary
configuration; other credentials can opt in with `meta: { secret: 'Y' }`.

Metadata updates use `odbOracle.jsonMergePatch` through `odbQuery` and
`SELECT ... INTO`. Its SQL-only `RETURNING CLOB` clause must not be emitted as
a direct PL/SQL assignment.

Install `odbAudit` before `odbSettings` for key-provider failure logging, and grant
`EXECUTE ON DBMS_CRYPTO`, `UTL_RAW`, and `UTL_I18N` as required by the database.

### `read`

Reads a setting by ID.

`read` decrypts secrets for trusted PL/SQL callers, including SMTP delivery.
Use `odbSettings.readMasked(id, value, meta)` (`odb_settings.read_masked`) for
presentation: secret values are always `********`, even when empty. This path
does not fetch or use the master key. Both sandbox list and get use masked output.
`list` also always masks secrets, retaining the `id`, `value`, `meta` response shape.

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

Call the package from an application package and declare authorization in its service contract:

```ts
import { defineService, odbPackage, odbSettings } from '@odbvue/odb'

const api = odbPackage('pck_app_api', (pkg) => {
  const readSetting = pkg.proc(
    'read_setting',
    {
      in: { id: odbSettings.types.id },
      out: { value: odbSettings.types.value, meta: odbSettings.types.meta },
    },
    ({ params: { id, value, meta }, body }) => {
      body.call(odbSettings.readMasked(id, value, meta))
    },
  )

  defineService(readSetting, {
    auth: { roles: ['admin'] },
    method: 'GET',
    path: '/settings/:id',
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

## Master Key And Encryption

Secret writes encrypt automatically; updates without metadata preserve the existing
secret flag. A write of the display mask `********` to a secret raises
`SETTINGS_SECRET_MASKED_VALUE`, rather than replacing the credential.
The sandbox editor treats secrets as password-style replacement fields, not readable
configuration. Trusted callers can explicitly write `NULL` to clear a secret.

When `APP_SETTINGS_MASTER_KEY_URI` is set, the provider reads exclusively from
OCI Vault. Set it to an
OCI Vault secret-bundle endpoint:

```text
https://secrets.vaults.<region>.oci.oraclecloud.com/20190301/secretbundles/<secret-ocid>
```

The secret OCID must start with `ocid1.vaultsecret.`, not `ocid1.secret.`.

Enable the database resource principal, grant its dynamic group permission to read
that Vault secret, and provision outbound HTTPS access as required. The secret
bundle's Base64 content must decode to exactly **32 raw key bytes**, not a
64-character hexadecimal text value. `DBMS_CLOUD` is invoked dynamically, allowing
local databases to use a generated local key without installing the cloud packages.
The request is defined with the typed `odbDbmsCloud` Oracle wrappers and
`ProcedureBody.executeImmediate` block builder, rather than handwritten PL/SQL.

If the URI is not set, the database generates a deterministic 32-byte local key
by hashing the UTF-8 encoding of `SYS_CONTEXT('USERENV', 'DB_UNIQUE_NAME')` with
`DBMS_CRYPTO.HASH_SH256`. The query uses `odbQuery` and typed Oracle wrappers
with `SELECT ... INTO ... FROM dual`; no access to `v$database` is needed.
`ov setup` no longer generates, reads, validates, or stores a master key.
`ODBVUE_APP_MASTER_KEY` and the `masterKey` SQL-generation option are retired.

With a configured URI, request errors, missing content, and invalid key lengths
are audit-logged and raise exceptions; they never select the local key.
Only successfully loaded, validated keys are cached in private package variables
for the current database session, for both providers. Every key use checks the
current URI: changing or removing it clears the cache and reloads the key.
A failed load leaves the cache empty so later calls retry. Rotating a Vault secret
at the same URI requires resetting database sessions/package state to refresh
cached keys. Masked reads and ordinary configuration remain available without
loading a key. Empty bootstrap secrets require no key.

Ciphertext uses AES-256-CBC with a fresh random IV and encrypt-then-HMAC-SHA256.
Encryption and authentication keys are derived separately from the master key.
The versioned envelope authenticates the setting ID, IV, and ciphertext, and
verification occurs before decryption. Text is encoded as UTF-8.

**Security boundary:** the local key is derived from a non-secret database name
and can be reproduced by anyone who knows that name. It is intended for local
development, not as a production secret. Databases sharing `DB_UNIQUE_NAME`
derive the same key; changing the name changes the key. Use resource-principal
Vault access in production. Encryption does not protect against
a compromised schema owner or an authorized caller of the internal decrypted API.
Never return the master key through Settings.

Changing provider or key does not rotate existing ciphertext: decrypt and
re-encrypt secrets under a controlled rotation procedure before retiring an old
key. For existing deployments using the old environment/package-constant key,
either provision those same 32 bytes in Vault before redeploying, or decrypt with
the old implementation and re-encrypt under the new local key. Redeploying alone
cannot migrate ciphertext. Loss of the original key makes stored secrets
unrecoverable.

## Deployment

This updates the bootstrap table layout (`value` becomes CLOB, with a virtual
`secret` column). Redeploy the database when editing the original migrations.
Existing deployments otherwise need an explicit table/data migration; editing
an applied bootstrap does not migrate an existing table.
