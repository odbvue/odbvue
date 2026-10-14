# Authentication

`odbAuth` is a database capability, not an HTTP service. It installs users, sessions, roles, user-role grants, and role-permission records. It hashes passwords with PBKDF2-SHA512, issues short-lived access JWTs, rotates opaque refresh tokens, and checks live grants. The package has no ORDS routes and reads no headers or cookies. Applications declare access policy through `defineService`; the generated handler manages bearer authentication and ODB error translation.

## Capability vs service

`odbAuth` owns:

- the user and session schema;
- password hashing and verification;
- access-token and refresh-token primitives;
- `login`, `refresh`, `logout`, `read_user`, and `require_user`;
- signup, email confirmation, and single-use password recovery tokens;
- standard ODB errors (`UNAUTHORIZED`, `NOT_FOUND`, `TOO_MANY_REQUESTS`).

The application owns:

- login, refresh, logout, and `me` endpoints and their shapes;
- choosing service authorization policies, reading `Cookie`, and writing `Set-Cookie`;
- authorization policy (who may call what);
- mapping ODB errors to HTTP responses.

The test for placement: would another PL/SQL package reasonably call this without HTTP? If yes, it belongs in `odbAuth`; if it concerns headers, cookies, status codes, or endpoint shape, it belongs in the application.

## Install

Install it through a migration after `odbRateLimit` and `odbSettings`.
Settings requires `odbAudit`. JWT configuration is loaded from Settings at runtime;
there is no built-in signing key, environment fallback, or package-embedded secret.

```ts
import { defineMigration, odbAuth, odbAudit, odbRateLimit, odbSettings } from '@odbvue/odb'

const schema = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('20260913120000_auth', { schema })
  .install(odbRateLimit)
  .install(odbAudit)
  .install(odbSettings)
  .install(odbAuth)
  .install(odbAuth.seedSettings())
  .install(
    odbAuth.seedUser({
      username: 'admin',
      password: process.env.ODBVUE_ADMIN_PASSWORD ?? 'change-me',
      displayName: 'Administrator',
    }),
  )
```

`seedUser()` is idempotent. Use a real secret manager for the initial password in deployed environments.

The runtime packages are defined through ODB's package and query builders. Installation and seeding are a separate concern: `odbAuth.upgrade()` renders idempotent DDL blocks, and seed helpers may render anonymous PL/SQL blocks. These are intentional SQL-string escape hatches, not handwritten runtime package implementations.

## JWT configuration

`odbAuth.seedSettings()` creates only missing settings. It never replaces an
existing key or configuration, and leaves the signing-key placeholder empty.
Provision it after deploying the database:

```sh
ov setup settings .config/dev/settings.json
# Equivalent commands:
ov setup-settings .config/dev/settings.json
ov ss .config/dev/settings.json
```

This configures SMTP, JWT, and the public application URL together. JSON keys are case-insensitive. Add these
non-secret values to the existing SMTP settings file:

```json
{
  "auth_jwt_issuer": "odbvue",
  "auth_jwt_expiration_seconds": 900,
  "app_public_url": "http://localhost:5173/"
}
```

| Setting                       | Contract                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `AUTH_JWT_SECRET`             | Required; exactly 64 hexadecimal characters, marked `secret=Y` and encrypted                         |
| `AUTH_JWT_ISSUER`             | Required; 1-255 visible ASCII characters without spaces; issued as `iss` and checked on verification |
| `AUTH_JWT_EXPIRATION_SECONDS` | Required; integer from 1 to 86400; seeded to 900                                                     |

When the secret is omitted, setup generates 32 cryptographically random bytes with
Node's `crypto.randomBytes`, encoded as hexadecimal. No key needs to be supplied
or stored in the local JSON file. Trusted deployments can optionally supply
`auth_jwt_secret` in that file. A valid 64-character hexadecimal key is preserved
unchanged; other non-blank text (up to 2000 characters) is normalized to the
lowercase hexadecimal SHA-256 digest of its exact UTF-8 bytes. The normalized key
is passed as a bind variable, never embedded in SQL or printed.
Hashing makes the format suitable but **does not add entropy**
to a weak password. Prefer omitting the field for a random production key.
Blank secret values are rejected.
Keep any file containing credentials out of source control.
The hexadecimal text itself is the HMAC key, matching the text-based signer;
it is not hex-decoded before signing.

Setup is an initial-configuration command: it writes the supplied settings and
adds the SMTP host ACL in one transaction. It does not read previous settings,
manage key rotation, or remove old host grants. Re-running setup updates the
values again; omitting the secret generates a new key each time. A supplied text
secret derives the same key on subsequent runs.

The JWT package caches the validated key, issuer, and expiration in private
variables for **30 seconds per database session**. An unexpired cache performs
no Settings reads. Expiry reloads and validates the complete configuration before
publishing it. A failed reload clears the cache, audit-logs a non-secret error,
and raises; stale configuration is not extended, and subsequent calls retry.
Configuration changes can therefore take up to 30 seconds to reach pooled sessions.
The cache contains decrypted key material in trusted database-session memory.

### Deployment boundary

Changing the signing key invalidates existing access-token signatures after
cached configuration refreshes. There is no key-rotation workflow, overlapping
old-key verification, or `kid` key ring in setup.
Issuer changes likewise invalidate tokens carrying the previous issuer after
the cache refresh. Expiration changes affect newly issued tokens, not the `exp`
already signed into existing tokens.

The sandbox Settings API masks the key and rejects writes/removals of
`AUTH_JWT_*`; use trusted setup or direct authorized database administration.
Auth seeds `AUTH_JWT_SECRET` with `secret=Y`; Settings preserves that flag on
subsequent writes even if replacement metadata says otherwise.
`ODBVUE_AUTH_JWT_SECRET` and the `jwtSecret` SQL-generation option are retired.
Rebuilding the original database migrations creates the new dependency order and
placeholders; run setup afterwards. No incremental migration is supplied here.

Use the [Settings Vault-backed master-key provider](./settings#master-key-and-encryption)
in production. The local master key is derived from a non-secret database name;
encryption under that fallback is not production secret protection.
Settings-backed JWT keys avoid deployment-time source embedding, but do not
protect against a compromised schema owner or an authorized decrypted Settings caller.

## HTTP Contract

The bootstrap migration (`apps/db/src/migrations/00000000000000-bootstrap.ts`)
installs `pck_app`, which exposes these endpoints beneath `/auth`. `odbAuth` does
not register them; the application package does. The sandbox retains duplicate
login, refresh, logout, and `me` procedures under `/sandbox/auth`, without
overwriting the application's public routes.

| Endpoint                      | Purpose                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/login`            | Accepts JSON `{ username, password }`, sets the refresh cookie, and returns `{ accessToken }`.                                               |
| `POST /auth/signup`           | Accepts JSON `{ email, fullName, password, passwordRepeat }`, creates an inactive account, and sends a confirmation email.                   |
| `POST /auth/confirm-email`    | Accepts JSON `{ token }`, consumes an unexpired confirmation token, and enables the account without creating a session.                      |
| `POST /auth/recover-password` | Accepts JSON `{ email }` and sends a reset link for an active account; unknown or disabled accounts receive the same empty success response. |
| `POST /auth/reset-password`   | Accepts JSON `{ token, password, passwordRepeat }`, changes the password, and revokes existing sessions without logging in.                  |
| `POST /auth/refresh`          | Rotates the refresh cookie and returns `{ accessToken }`.                                                                                    |
| `POST /auth/logout`           | Revokes the browser session and expires the refresh cookie.                                                                                  |
| `GET /auth/me`                | Requires bearer authentication and returns `userId`, `username`, `displayName`, `roles`, and `permissions`.                                  |

### Email signup

Redeploy the database from the reorganized bootstrap migration; this change
does not supply an incremental signup migration. Bootstrap installs the auth
confirmation table and all application authentication endpoints together in
`pck_app`, after the framework packages and settings. The signup page is available
at `/signup`, linked from Login; there is no Google sign-in or consent dialog.

Configure `APP_PUBLIC_URL` using `ov setup settings`, either through the prompt
(default `http://localhost:5173/`) or the case-insensitive `app_public_url` key
in the JSON settings file. Set it to the browser-facing application base URL,
for example `https://app.example.com/` in production. Use HTTPS in production;
the localhost prompt default is for development only. Credentials, query
strings, and fragments are not allowed. The setting is stored in the database,
not in the runtime YAML configuration. Existing SMTP
settings and the SMTP host ACL must also be configured. An empty/invalid URL,
missing SMTP configuration, or failed delivery is an error, not signup success.

Signup normalizes email addresses to lowercase, requires a nonblank full name
(up to 256 characters), and accepts passwords of 8-256 characters, including
spaces and symbols. Both password entries are checked by the application API.
New accounts cannot log in until confirmed and receive no roles by default.
`odbAuth.signup` returns an opaque random token to the trusted application;
only its hash is stored in the auth confirmation table. The queued email contains
the link, so administrator email-queue access is also trusted.

The email link expires after 24 hours. It carries the token in the URL fragment,
not a server-visible query string. The confirmation page removes the fragment
from browser history and requires an explicit click before posting the token;
merely opening the link does not activate an account. Tokens are single-use.
The user logs in normally after confirmation.

Account creation and the email queue entry are committed before SMTP delivery
(the sender runs autonomously). On delivery failure, the inactive account and
failed email remain for diagnosis. Retrying signup with the **same email and
password** sends a fresh link and invalidates the old one; it never replaces
another pending account's password or name. Confirmed or administratively
disabled accounts cannot be overwritten through signup. Signup and confirmation
attempts use the existing database rate limiter (signup by email and caller IP,
confirmation by caller IP). Behind a proxy, the database may see a shared IP;
deployment-level throttling should account for that.

### Password recovery

Login links to `/recover-password`. Recovery uses the same `APP_PUBLIC_URL`,
SMTP configuration, email queue, and delivery mechanism as signup. Redeploy
the bootstrap migration to install `odb_auth_password_resets` and the two new
anonymous endpoints.

Only active accounts are eligible; recovery never activates an unconfirmed
signup or re-enables an administratively disabled account. Requesting a link
does not disable the account or change its password. The response does not
disclose account existence. Configuration and delivery errors are still
reported as errors rather than success.

Recovery tokens are cryptographically random, stored only as hashes in the
auth table, separate from confirmation tokens, and expire after **one hour**.
Each request replaces the previous token for that account. The email links to
`/reset-password#token=...`; the page removes the fragment from browser history
and waits for a password form submission. Opening a link never consumes it.
As with signup, trusted email-queue administrators can see the link.

Reset requires matching passwords of 8-256 characters. An unexpired token is
consumed atomically with the password change, a token-version increment, and
revocation of all previous refresh sessions. Concurrent retries and reset
submissions serialize on the account, and login locks the account while
verifying credentials and issuing a session so an old-password login cannot
escape a concurrent reset. Reset also clears the account's login-attempt
throttle. The user must log in normally afterward.

Recovery attempts are throttled by normalized email and caller IP; reset
attempts are throttled by caller IP. Failed SMTP delivery leaves the committed
token and queued email available for diagnosis; retrying recovery sends a new
link. Neutral responses do not guarantee identical timing for unknown accounts
and SMTP delivery; deployment-level abuse protection remains important.

The access token is valid for `AUTH_JWT_EXPIRATION_SECONDS` (15 minutes by default)
and is rejected at or after its signed expiration. Refresh tokens are opaque,
are stored only as hashes in the database, expire after 30 days, and rotate on
every refresh. Revoking a session, disabling a user, or changing its token version
invalidates existing access tokens.

Authentication failures raise ODB errors that ORDS maps to HTTP responses, including `401 INVALID_CREDENTIALS` for invalid logins and `401 UNAUTHORIZED` for expired, revoked, or malformed sessions.

## Procedures

| Procedure          | Parameters                                                             | Behavior                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login`            | `p_username`, `p_password` IN; `p_access_token`, `p_refresh_token` OUT | Verifies credentials, opens a session. Raises `UNAUTHORIZED` (`INVALID_CREDENTIALS`) on failure.                                                    |
| `refresh`          | `p_refresh_token` IN; `p_access_token`, `p_next_refresh_token` OUT     | Rotates the refresh token. Reuse of a rotated token revokes the session.                                                                            |
| `logout`           | `p_refresh_token` IN                                                   | Revokes the session; unknown or empty tokens are ignored.                                                                                           |
| `recover_password` | `p_username` IN; `p_reset_token` OUT                                   | Returns a one-hour token for an enabled account, otherwise NULL. The trusted application sends the email.                                           |
| `reset_password`   | `p_token`, `p_password` IN                                             | Consumes a recovery token, changes the password, increments token version, and revokes sessions. Invalid tokens/passwords raise `VALIDATION_ERROR`. |
| `read_user`        | `p_user_id` IN; `p_username`, `p_display_name` OUT                     | Reads an enabled user; raises `NOT_FOUND` otherwise.                                                                                                |
| `require_user`     | `p_access_token` IN                                                    | Returns the user id behind a valid access token; raises `UNAUTHORIZED` otherwise.                                                                   |

Tokens are plain values. Use `odbHttp.defineCookie(...)` in the application package for refresh-token transport. Protected services automatically extract bearer tokens:

```ts
const refreshCookie = odbHttp.defineCookie({
  name: '__Host-odb_refresh',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  maxAge: odbAuth.refreshTokenMaxAge,
})

// login
body.call(odbAuth.login(username, password, accessToken, refreshToken))
body.set(setCookie, refreshCookie.set(refreshToken))

// refresh
body.call(odbAuth.refresh(refreshCookie.read(cookie), accessToken, nextRefreshToken))
body.set(setCookie, refreshCookie.set(nextRefreshToken))

// logout
body.call(odbAuth.logout(refreshCookie.read(cookie)))
body.set(setCookie, refreshCookie.expire())
```

Reuse `odbAuth.types` (`username`, `password`, `accessToken`, `refreshToken`, `userId`, `displayName`) for parameters instead of redeclaring them. Install `odbAuth` after `odbRateLimit` and `odbSettings`; login throttling uses the former and JWT configuration uses the latter.

## Authorization

Every `defineService` requires an explicit `auth` policy:

```ts
auth: 'anonymous'                         // no bearer authentication
auth: 'authenticated'                     // valid user and session
auth: { roles: ['admin'] }                 // all listed roles
auth: { permissions: ['settings.read'] }   // all listed permissions
auth: { roles: ['admin', 'operator'], match: 'any' }
```

When both roles and permissions are supplied, `match` applies across all listed requirements; its default is `all`. Empty policies and empty requirement lists are rejected. Names are exact and case-sensitive, with a maximum length of 200 characters. Authentication failures return 401; authenticated users lacking access receive 403.

Roles are stored in `odb_auth_roles`, user assignments in `odb_auth_user_roles`, and role permissions in `odb_auth_role_permissions`. Grants apply from `valid_from` inclusively until `valid_to` exclusively; NULL `valid_to` means no expiry. Only enabled users qualify. Roles and permissions are checked in the database on every request, not embedded in JWTs, so revocation applies to subsequent requests immediately.

```ts
migration
  .install(odbAuth.role.seed({ name: 'admin', permissions: ['settings.read'] }))
  .install(odbAuth.role.seedGrant({ username: 'admin', role: 'admin' }))

body.call(odbAuth.role.grant(userId, odbLiteral('admin')))
body.call(odbAuth.role.revoke(userId, odbLiteral('admin')))
body.call(odbAuth.permission.grant(odbLiteral('admin'), odbLiteral('settings.read')))
body.call(odbAuth.permission.revoke(odbLiteral('admin'), odbLiteral('settings.read')))
body.call(odbAuth.role.require(userId, odbLiteral('admin')))
body.call(odbAuth.permission.require(userId, odbLiteral('settings.read')))
```

`role.has` and `permission.has` return typed BOOLEAN expressions. `role.define` upserts role descriptions. `role.grant` accepts optional `validFrom` and `validTo` expressions and replaces an existing assignment's validity window. Grant-management calls do not commit and do not authorize their caller; expose administrative operations only through protected application services. Seeds upsert or add records; omitting a permission from a seed does not revoke it.

For a procedure that needs the verified caller, declare an ordinary IN string parameter and bind it with `context: { userId: procedure.parameters.userId }`. This binding is available only to protected services and is never exposed as a request parameter. Internal package callers still pass the identity explicitly; framework business capabilities such as settings do not enforce application policy.

`odbAuth.readAuthorization(userId, roles, permissions)` returns JSON arrays through OUT parameters. The sandbox profile uses it for `useAuth().hasRole()` and `.can()`. These browser checks are presentation hints; server enforcement remains authoritative.

The application uses only bootstrap and sandbox migrations and is reinstalled for schema changes. Bootstrap seeds `admin@odbvue.com` with the admin role and `test@odbvue.com` with password `MySecurePass123!` and no roles or permissions. The test user can authenticate and read its profile but cannot access admin-protected settings or audit services. These are development accounts; use deployment-specific credentials in production.

## Browser Runtime

Browser authentication lives in `apps/web/src/capabilities/auth`. `apps/web/odbvue.config.ts` configures application options only and does not install database objects. Use `auth: { endpoints: { ... } }` to override endpoint URLs.

Use `useAuth()` in components and composables. `restore()` runs automatically when the runtime starts; it restores the access token from the refresh cookie and then loads the current user.

```ts
import { useAuth } from '@/capabilities/auth'

const auth = useAuth()

await auth.login({ username: 'ada', password: 'correct horse battery staple' })
await auth.me()

if (auth.authenticated.value) {
  console.log(auth.user.value?.username)
}
```

Login and refresh requests include browser credentials so ORDS can set and receive the refresh cookie. Set `http.openapi` to the generated database OpenAPI document, as the sandbox configuration does. The HTTP client supplies the token only to documented bearer operations, skips anonymous and unknown operations, and refreshes/retries a protected request once after a 401. It never refreshes on 403 or automatically sends tokens to absolute URLs. Without a document, ordinary relative requests retain legacy bearer behavior, except login, refresh, and logout. Keep the application on HTTPS in production: the default `__Host-odb_refresh` cookie is `Secure`, `HttpOnly`, and `SameSite=Lax`.
