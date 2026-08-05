# JWT

`odbJwt` exposes an odb framework package, `odb_jwt`, for signing and verifying [JSON Web Tokens](https://datatracker.ietf.org/doc/html/rfc7519) with HMAC-SHA256 (`HS256`). It is installed into your schema by a migration (it is not a native Oracle built-in).

Use it in migrations for two things:

- install or drop the database package with `toSQLUp()` and `toSQLDown()`
- call the signing / verification helpers from your own package bodies

The package is intentionally generic: you build whatever JSON claims payload you need with `JSON_OBJECT`, sign it with a secret, and read claims back after verification.

## Install In A Migration

```ts
import { defineMigration, odbJwt } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('20260802120000_jwt', {
  schema: schemaName,
}).install(odbJwt)
```

## Sign A Token

Build the claims payload with `JSON_OBJECT`, then pass it to `odb_jwt.encode`:

```ts
import { odbPackage } from '@odbvue/odb'

const appPackage = odbPackage('pck_app', (p) => {
  p.proc('login', (proc) => {
    const uuid = proc.in('uuid', 'VARCHAR2')
    const token = proc.out('token', 'VARCHAR2')

    proc.body((body) => {
      const vPayload = body
        .varchar2('v_payload', 2000)
        .assign(
          `JSON_OBJECT('sub' VALUE p_uuid, 'iss' VALUE 'odbvue', ` +
            `'iat' VALUE odb_jwt.to_epoch(), 'exp' VALUE odb_jwt.to_epoch() + 3600)`,
        )
      body.set(token, odbJwt.encode('v_payload', `'my-secret'`))
    })
  })
})
```

## Verify And Read Claims

`verify` returns `1`/`0` for a valid signature; `claim` reads a single claim (after you have verified the token):

```ts
const uuid = proc.out('uuid', 'VARCHAR2')

proc.body((body) => {
  const vToken = body.varchar2('v_token', 2000).value('...')

  body.raw(
    `IF ${odbJwt.verify('v_token', `'my-secret'`)} = 1 ` +
      `AND ${odbJwt.isExpired('v_token')} = 0 THEN`,
  )
  body.set(uuid, odbJwt.claim('v_token', `'sub'`))
  body.raw(`END IF;`)
})
```

## Expression Helpers

| Helper                      | PL/SQL                     | Returns                                         |
| --------------------------- | -------------------------- | ----------------------------------------------- |
| `encode(payload, secret)`   | `odb_jwt.encode`           | `VARCHAR2` — signed `header.payload.signature`  |
| `verify(token, secret)`     | `odb_jwt.verify`           | `0`/`1` — valid signature                       |
| `payload(token)`            | `odb_jwt.payload`          | `VARCHAR2` — decoded JSON claims (no check)     |
| `claim(token, name)`        | `odb_jwt.claim`            | `VARCHAR2` — a single claim (no check)          |
| `isExpired(token, leeway?)` | `odb_jwt.is_expired`       | `0`/`1` — `exp` in the past                     |
| `base64urlEncode(input)`    | `odb_jwt.base64url_encode` | `VARCHAR2`                                      |
| `base64urlDecode(input)`    | `odb_jwt.base64url_decode` | `VARCHAR2`                                      |
| `toEpoch(timestamp?)`       | `odb_jwt.to_epoch`         | `INTEGER` — Unix seconds (defaults to now, UTC) |
| `fromEpoch(epoch)`          | `odb_jwt.from_epoch`       | `TIMESTAMP` (UTC)                               |

## Notes

- Only the `HS256` algorithm is supported. The secret is a shared HMAC key — keep it out of source control (read it from a setting).
- `verify` only checks the signature. Validate registered claims (`exp`, `nbf`, `iss`, `aud`) yourself with `claim` / `isExpired` according to your policy.
- `payload` and `claim` decode without verifying — never trust their output before `verify` returns `1`.
