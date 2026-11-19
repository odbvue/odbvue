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
import { defineMigration, odbSettings, odbValidation } from '@odbvue/odb'

export const migration = defineMigration('20260802140000_settings', {
  schema: process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? '',
})
  .install(odbValidation)
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
It rejects any non-empty `value` when `meta.secret` is `'Y'`, both at seed creation
and SQL generation. The owning capability declares which settings are secret;
Settings does not infer secrecy from IDs.
Encryption during `write` does not protect plaintext literals in source or generated SQL.
Seed an empty placeholder instead:

```ts
odbSettings.seed({ id: 'SMTP_PASSWORD', value: '', meta: { secret: 'Y' } })
```

Supply actual credentials after deployment through bind variables, as
`ov setup-settings` does for SMTP credentials and JWT provisioning. Never put
credentials in migration literals. [Auth](./auth#jwt-configuration) loads its
signing key and configuration through the trusted decrypted Settings API, with
a bounded session-local cache.

`odbSettings` is transport-independent. It provides database operations and raises standard ODB errors such as `NOT_FOUND`.

HTTP exposure, authorization, and mapping ODB errors to HTTP responses belong to the application service.

## Procedures

| Procedure         | Parameters                                                     | Behavior                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`            | `p_after` IN JSON, `p_limit` IN, `p_items` OUT `SYS_REFCURSOR` | Ordered by `id`, after a decoded cursor tuple (`NULL` for the first page). Returns the displayed limit plus one lookahead row (`NULL` limit uses the shared default 25). Columns: `id`, `value`, `meta`, `protected`. |
| `read`            | `p_id` IN, `p_value` OUT, `p_meta` OUT                         | Reads one setting, decrypting secrets; raises the ODB `NOT_FOUND` error if it does not exist.                                                                                                                         |
| `read_masked`     | `p_id` IN, `p_value` OUT, `p_meta` OUT                         | Reads one setting, returning `********` for secrets without loading the key.                                                                                                                                          |
| `write`           | `p_id`, `p_value`, `p_meta` IN                                 | Creates or updates a setting. A `NULL` `p_meta` keeps existing metadata (`{}` on create).                                                                                                                             |
| `remove`          | `p_id` IN                                                      | Deletes a setting from trusted code.                                                                                                                                                                                  |
| `write_protected` | Same as `write`                                                | Writes a setting and marks it as protected. For trusted provisioning only.                                                                                                                                            |
| `update_editable` | `p_id`, `p_value` IN                                           | Updates an existing unprotected setting without changing metadata.                                                                                                                                                    |
| `remove_editable` | `p_id` IN                                                      | Deletes an existing unprotected setting unless its metadata disallows deletion.                                                                                                                                       |

`meta` is JSON text for presentation and editable-value validation.
`meta.secret` is reserved: `'Y'` marks an encrypted secret; omitted, `null`, or
`'N'` means ordinary configuration. The table exposes this flag as a virtual
`secret` column. Plaintext input is limited to 2000 characters. The stored `value`
is a CLOB so encrypted UTF-8 values can grow without truncation.
Both the write-path lookup and virtual column use `NULL ON EMPTY` with
`ERROR ON ERROR`: an omitted flag defaults to `'N'`, but malformed/non-scalar
flag values are not silently treated as ordinary configuration.

Once a stored setting is secret, `write` preserves `secret: 'Y'` even when replacement
metadata omits the flag, sets it to `null`, or sets it to `'N'`. Other replacement
metadata fields still take effect. Ordinary writes cannot downgrade a secret;
any intentional downgrade requires an explicit privileged database operation.
New settings default to ordinary configuration unless their metadata declares
`secret: 'Y'`. Auth and Email provisioning declare their own secret metadata,
including when recreating settings after deletion.

Metadata updates use `odbOracle.jsonMergePatch` through `odbQuery` and
`SELECT ... INTO`. Its SQL-only `RETURNING CLOB` clause must not be emitted as
a direct PL/SQL assignment.

Install `odbAudit` before `odbSettings` for key-provider failure logging, and grant
`EXECUTE ON DBMS_CRYPTO`, `UTL_RAW`, and `UTL_I18N` as required by the database.
Install [Validation](./validation) before Settings; editable-value validation
delegates portable rules to `odb_validation`.

### `read`

Reads a setting by ID.

`read` decrypts secrets for trusted PL/SQL callers, including SMTP delivery.
Use `odbSettings.readMasked(id, value, meta)` (`odb_settings.read_masked`) for
presentation: secret values are always `********`, even when empty. This path
does not fetch or use the master key. Both sandbox list and get use masked output.
`list` also always masks secrets and includes the `protected` flag.

If the setting does not exist, `read` raises the standard ODB `NOT_FOUND` error. The caller decides how that error is exposed; for example, an ORDS service may map it to HTTP 404.

### `list`

Settings uses database-native keyset pagination:

```ts
odbSettings.list(after, limit, items)
```

- `after` is a decoded JSON ordering tuple, or `NULL` for the first page.
- `limit` is the displayed page size; the query fetches one additional row.
- `items` is the result set.

Pagination is inferred automatically on a delegating service. The framework preserves the
capability's typed pagination metadata, validates opaque public tokens, trims
lookahead, and returns `{ items, nextCursor? }`. Neither the page nor the service
needs to derive a cursor from an ID. See [Cursor pagination](../toolkit.md#cursor-pagination).

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

The sandbox API migration (`apps/db/src/migrations/00000000000002-sandbox.ts`) shows the full set of `list`, `read`, `write`, and `remove` services in one `pck_sandbox` package.

### Admin settings

The **Admin → Settings** page lists existing settings with case-insensitive
setting ID search and cursor pagination (`GET /admin/settings`). The admin list
returns a `secret` flag and `null` instead of the stored value for secrets.
`PUT /admin/settings/:id` updates an existing setting and returns `204 No Content`.
Ordinary values can be cleared; secrets require a new, non-empty replacement.
The update audit records the actor and setting ID, not the value.

`protected` is independent of `secret`. Bootstrap marks the master-key URI
protected. Authentication settings are editable by administrators. Admin and Sandbox
require an existing row for edits and reject protected rows; Sandbox deletion
also rejects settings with `meta.deletable: 'N'`. Authentication settings carry
that flag so they remain editable but cannot be deleted through Sandbox. A
missing row returns 404; protected or non-deletable rows return 403.
Use trusted setup for those settings. Changing an SMTP host or port
through the editor does not update network ACLs; use `ov setup-settings` for that.

### Editable field metadata

The admin list returns metadata but never returns secret values. `type` selects
the form control: `string` (legacy alias for `text`), `text`, `textarea`,
`markdown`, `number`, `switch`, `checkbox`, `select`, `combobox`, `autocomplete`,
`email`, `password`, `color`, `date`, `time`, or `datetime`. A `select` requires
an `items` array of strings and the API checks membership. Switches and checkboxes
store `Y` or `N`. Values remain stored as strings; `number` accepts a signed
decimal with at most 15 integer and 10 fractional digits. File, custom component,
rating, and duration fields are not supported for settings.

`rules` is an array of form-compatible `{ type, params, message? }` objects.
The portable rules are `required`, `min-length`, `max-length`, `equals`,
`equals-not`, `greater-than`, `less-than`, `in-range`, `set`, and `custom`.
Length parameters are nonnegative integers; equality parameters are strings;
numeric comparisons take numbers; `in-range` takes two ascending numbers and
`set` takes an array of strings. Missing values are treated as empty strings.
Numeric comparisons use the same decimal syntax as `number`. Unknown types,
rules and custom names are rejected rather than ignored.

Custom validators use registered names, not executable code or arbitrary
JavaScript regexes. The currently registered names are `jwt-secret` (64 hex
characters), `jwt-issuer` (1–255 visible ASCII characters), `jwt-expiration`
(integer 1–86400), and `port` (integer 1–65535). Adding another requires an
implementation in both the editor and database validator. An optional `message`
is a translation key; otherwise the editor uses a generic localized error.

```ts
odbSettings.seed({
  id: 'RETRY_COUNT',
  value: '3',
  meta: {
    type: 'number',
    rules: [{ type: 'required' }, { type: 'in-range', params: [1, 10] }],
  },
})
```

Changing authentication settings can interrupt sign-in. JWT configuration is
cached per database session for up to 30 seconds; rotating its signing secret
invalidates existing access tokens once sessions reload it. Changing LDAP or
Google network settings does not create ACL grants or external provider
configuration; provision those separately through trusted setup.

## Calling From PL/SQL

The `odbSettings` helpers return typed calls for `body.call(...)`:

```ts
body.call(odbSettings.write(id, value)) // keeps existing meta
body.call(odbSettings.write(id, value, metaJson))
body.call(odbSettings.list(after, limit, items)) // decoded tuple; displayed limit
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

The bootstrap table includes the `protected` column and its initial values.
Redeploy from the updated bootstrap. For an in-place upgrade, add the column and
backfill protected rows before exposing the new routes; editing an applied
migration does not update an existing table.
