# Authentication

`odbAuth` is a database capability, not an HTTP service. It installs users, login identities, sessions, roles, user-role grants, and role-permission records. It hashes passwords with PBKDF2-SHA512, issues short-lived access JWTs, rotates opaque refresh tokens, and checks live grants. The package has no ORDS routes and reads no headers or cookies. Applications declare access policy through `defineService`; the generated handler manages bearer authentication and ODB error translation.

## Capability vs service

`odbAuth` owns:

- the user and session schema;
- password hashing and verification;
- access-token and refresh-token primitives;
- `login`, `refresh`, `logout`, `read_user`, and `require_user`;
- signup, email confirmation, and single-use password recovery tokens;
- standard ODB errors (`UNAUTHORIZED`, `NOT_FOUND`, `TOO_MANY_REQUESTS`).

The application owns:

- login, refresh, logout, and `getState` endpoints and their shapes;
- choosing service authorization policies, reading `Cookie`, and writing `Set-Cookie`;
- authorization policy (who may call what);
- mapping ODB errors to HTTP responses.

The test for placement: would another PL/SQL package reasonably call this without HTTP? If yes, it belongs in `odbAuth`; if it concerns headers, cookies, status codes, or endpoint shape, it belongs in the application.

## Install

Install it through a migration after `odbRateLimit`, `odbSettings`, `odbLob` and `odbStorage`.
Settings requires `odbAudit`. JWT configuration is loaded from Settings at runtime;
there is no built-in signing key, environment fallback, or package-embedded secret.
The schema also needs a direct `EXECUTE ON SYS.DBMS_LDAP` grant before compiling
auth, even when LDAP is disabled; bootstrap provisions it.

```ts
import {
  defineMigration,
  odbAuth,
  odbAudit,
  odbRateLimit,
  odbSettings,
  odbLob,
  odbStorage,
} from '@odbvue/odb'

const schema = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('20260913120000_auth', { schema })
  .install(odbRateLimit)
  .install(odbAudit)
  .install(odbSettings)
  .install(odbLob)
  .install(odbStorage)
  .install(odbAuth)
  .install(odbAuth.seedSettings())
  .install(odbAuth.config({ password: true, twoFactor: true, google: true, signup: true }))
  .install(
    odbAuth.seedUser({
      username: 'admin',
      password: process.env.ODBVUE_ADMIN_PASSWORD ?? 'change-me',
      displayName: 'Administrator',
    }),
  )
```

`seedUser()` is idempotent. Use a real secret manager for the initial password in deployed environments.
It seeds the account and its password identity separately; it does not put credentials
on the user record.

The schema, runtime packages, and seed logic are defined through TypeScript table,
package, query, and `odbBlock` builders. Seed helpers use typed declarations,
conditions, queries, and procedure calls rather than handwritten PL/SQL blocks.
The builders generate the SQL required by Oracle at deployment time.
`odbBlock(build)` returns a SQL\*Plus-ready string for a migration artifact's
`toSQLUp()` method. Its callback uses the same `variables`, `query`, `call`,
`ifThen`, and exception-handler methods as package bodies, including
`savepoint(name)` and `rollback(name)` for transactional seed operations.

## Authentication policy and two-factor authentication

`odbAuth.config()` is an installable, Settings-backed deployment policy. LDAP
defaults to `false`; the other four flags default to `true`:

```ts
// Install after auth/Google settings seeds and before the application package.
.install(odbAuth.config({
  password: true,  // Username/email and password
  twoFactor: true, // Required TOTP for every password account
  google: true,
  signup: true,
  ldap: false,     // Opt-in LDAPS; searched before local password identities
}))
```

The corresponding Settings keys are `AUTH_PASSWORD_ENABLED`,
`AUTH_TWO_FACTOR_ENABLED`, `AUTH_GOOGLE_ENABLED`, `AUTH_SIGNUP_ENABLED`,
and `AUTH_LDAP_ENABLED`
(`Y`/`N`). `seedSettings()` inserts missing policy values without replacing existing
ones; `config()` writes the requested deployment values. Runtime reads validate
the values and enforce policy inside the database capability. Missing/invalid
settings raise an error rather than enabling a fallback. Provider flags are not
authorization grants and do not revoke sessions that already exist.

Password login, signup, password recovery/reset, and password changes are rejected
when password authentication is disabled. Signup additionally requires the signup
flag; Google can still authenticate existing identities when signup is disabled,
but cannot create new accounts. Google is available only when enabled **and**
its client ID, secret, and callback URI are configured. State checks use masked
settings and never decrypt the Google secret. Google continues to own its own
second-factor policy; this application's TOTP requirement applies to local and LDAP
username/password logins.

The trusted setup JSON optionally accepts `auth_password_enabled`,
`auth_two_factor_enabled`, and `auth_signup_enabled` as booleans. Omitted values
are preserved. Google uses the existing `auth_google_enabled` option. The sandbox
Settings API rejects writes/removals of all `AUTH_*` keys.

### LDAP and LDAPS sign-in

Enable with `odbAuth.config({ ldap: true })` after configuring the directory, or
with `ov ss` / `ov setup-settings`. LDAP is disabled by default and is not inferred
from a saved hostname. The existing username/password form and `/auth/login`
endpoint are used; users do not choose a provider. `/auth/state` includes a
`providers.ldap` boolean, so the form remains available when local passwords are
disabled.

`odbAuth.seedSettings()` inserts the following missing settings without overwriting
existing values:

| Setting                     | Default       | Purpose                                                    |
| --------------------------- | ------------- | ---------------------------------------------------------- |
| `AUTH_LDAP_ENABLED`         | `N`           | Enable LDAP-first credential verification                  |
| `AUTH_LDAP_TLS_ENABLED`     | `N`           | `Y` requires verified LDAPS; `N` skips `OPEN_SSL`          |
| `AUTH_LDAP_HOST`            | empty         | Hostname only, without `ldaps://` or a path                |
| `AUTH_LDAP_PORT`            | `389`         | Explicit port; normally 389 for LDAP, 636 for LDAPS        |
| `AUTH_LDAP_BASE_DN`         | empty         | Subtree search base                                        |
| `AUTH_LDAP_LOGIN_ATTRIBUTE` | `uid`         | Login attribute, e.g. `uid` or `sAMAccountName`            |
| `AUTH_LDAP_BIND_DN`         | empty         | Read-only service account used to search                   |
| `AUTH_LDAP_BIND_PASSWORD`   | empty, secret | Service account password                                   |
| `AUTH_LDAP_WALLET_PATH`     | empty         | Optional database-side Oracle wallet location (`file:...`) |
| `AUTH_LDAP_WALLET_PASSWORD` | empty, secret | Optional wallet password                                   |

Both passwords use encrypted Settings metadata (`secret: 'Y'`), masked CLI
prompts, and SQL bind variables. Never put real credentials in migrations or
commit a settings JSON file containing them. Both wallet fields may be empty or
omitted from setup JSON. Omitted fields preserve existing saved values; empty
strings clear them.

**Transport is explicit, not inferred from the port.** The trusted setup JSON
accepts `"auth_ldap_tls_enabled": false` (the seeded default) for ordinary LDAP
without `OPEN_SSL`. This can transmit both service-account and user passwords
without encryption; use it only for trusted test environments. Set
`"auth_ldap_tls_enabled": true` and the correct port (normally 636) for LDAPS:
`DBMS_LDAP.open_ssl(..., 2)` then requires server-authenticated TLS before any bind.
TLS errors never trigger plaintext fallback. StartTLS and unauthenticated TLS
are not supported. Stored mode values must be `Y` or `N`; missing/invalid
configuration fails explicitly rather than selecting a transport.

On **Autonomous Database**, Oracle ignores `SSLWRL` and `SSLWALLETPASSWD` and uses
the database-managed outbound trust wallet. Leave both settings empty or omit
them; no application-managed wallet is required. The directory certificate must
be trusted by that managed wallet. Public-endpoint Autonomous Database connections
require a hostname (not an IP address) and port 636. See Oracle's
[DBMS_LDAP package notes](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-plsql-packages.html#GUID-644A5423-25D0-46C0-B4A7-279A4ECB09D6).

On **standard Oracle Database**, server-authenticated LDAPS may require an explicit
database-side wallet containing the directory's trusted CA chain, and its password
unless a supported auto-login wallet is used. Accepting empty setup values does
not bypass the database's TLS requirements; missing trust fails explicitly at login.

Interactive `ov ss` offers LDAP disabled by default. A trusted JSON settings file
may specify `AUTH_LDAP_ENABLED: true` and the keys above (case-insensitive; the port
is a JSON number). Missing required enabled-directory fields prompt, with defaults
`389` and `uid`. Choose port 636 explicitly when enabling LDAPS. Optional wallet
and TLS-mode fields do not prompt in file mode. Omitted LDAP enable and TLS flags
preserve their saved values; they do not silently disable an existing TLS configuration.
Disabling preserves saved credentials and grants. SMTP/JWT/application setup
requirements remain unchanged.

Setup adds the exact-host/port `connect` grant through
`odbAcl.addLdap(host, port)` in the same transaction as the settings writes.
Oracle's LDAP client requires `connect`, not the HTTP/SMTP-specific privileges.
This is broader than a protocol-specific grant, but remains restricted to the
configured host and port. The admin-only sandbox ACL page also supports LDAP
grant/removal. Changing settings never removes old ACL grants automatically.

The server normalizes the submitted username as for local login, escapes LDAP
filter assertion values per RFC 4515, and performs a ten-second bounded subtree
search using the service account. The outcomes are deliberately distinct:

- **Zero entries:** try the existing local password flow, only if password auth
  is enabled.
- **Exactly one entry:** bind as that entry with the submitted password. Wrong
  credentials never fall back to a local identity.
- **Multiple entries, directory/TLS/search/configuration failures:** fail explicitly;
  never treat an unavailable directory as "user not found."

Empty passwords are rejected before LDAP access, preventing anonymous binds.
Rate limiting applies before contacting the directory. LDAP handles/results are
released and the package's exception mode is restored for pooled database sessions.
The search timeout does not impose a deadline on DNS, TLS, or bind operations.

A successful first bind creates an enabled account and a separate `ldap` identity
keyed by the returned DN (maximum 255 characters); no LDAP password is stored.
Automatic registration requires the signup flag. Existing local/Google username
collisions are rejected (`LDAP_USERNAME_EXISTS`), not linked or merged. Existing
LDAP accounts must still be locally enabled. All successful LDAP credential checks
continue through the same TOTP enrollment/challenge policy as local passwords.
Local password recovery/change does not manage directory credentials.

This is a single-directory integration. Changing the configured directory or
renaming/reusing DNs requires deliberate identity migration; do not repoint an
installation with existing LDAP identities to another directory. Directory
password changes and disablement are checked at the next credential login, not
on every access/refresh token use; revoke local sessions when immediate removal
is required.

The public `ldap.forumsys.com` directory is not a seeded default. Its commonly
published LDAP credentials do not establish that port 636 supports LDAPS or that
its certificate is trusted by your Oracle wallet. For public test credentials on
port 389, explicitly select `"auth_ldap_tls_enabled": false`. Never send production
credentials to a public test directory. Production directories should use LDAPS.

These bootstrap changes target fresh deployment. Editing an applied bootstrap
migration does not upgrade an existing database: provision the direct grant,
replace the auth/ACL and application packages, and seed missing settings through
your deployment process before enabling LDAP. Regenerate the deployed OpenAPI
manifest and web types after deployment.
When upgrading the earlier TLS-only implementation, explicitly provision
`AUTH_LDAP_TLS_ENABLED = Y` to preserve LDAPS, or `N` to opt into ordinary LDAP.
`ov ss` writes this setting when the JSON includes `auth_ldap_tls_enabled`.

### Password login and enrollment

`odbAuth.beginLogin(username, password, accessToken, refreshToken, challenge, setupSecret)`
validates credentials under the account lock. With 2FA disabled it opens a session.
Otherwise it returns a random, five-minute, single-use challenge and **no tokens**.
An account without an authenticator, including the seeded administrator, also
receives a 32-character Base32 setup key. The login page displays a scannable QR code,
generated locally in the browser from the `otpauth://` URI. Manual key entry remains
available under "Can't scan the code?", alongside an authenticator-app link.
No external QR-code service receives the key. A QR-generation error is reported
explicitly and opens the manual-key fallback. QR images are kept only in component
memory and removed when enrollment is completed or cancelled.
Pending setup is not an authenticated session.

`odbAuth.verifyTwoFactor(challenge, code, accessToken, refreshToken, recoveryCodes, nextChallenge, setupSecret)`
accepts a six-digit authenticator code. TOTP uses RFC 6238 (SHA1, 30-second steps,
six digits, UTC, one step of clock skew in either direction). Accepted counters
cannot be replayed, including immediately after enrollment; wait for the next
code if necessary. Keep the database clock synchronized.

Successful enrollment confirms the secret before activating it, revokes previous
sessions, opens the new session, and returns **ten** random 128-bit recovery codes.
The browser displays them once before continuing to the original destination.
Save them in a password manager. Secrets, challenges, passwords, tokens, and recovery
codes are not persisted in browser storage.

TOTP secrets (including pending enrollment) use the Settings authenticated-encryption
helper, bound to the account ID, but are stored in dedicated auth tables rather
than publicly listable Settings entries. Configure the
[Vault-backed master key](./settings#master-key-and-encryption) in production;
the local database-name-derived fallback is not production secret protection.
Only hashes of challenges and recovery codes are stored. Verification and challenge
creation are rate-limited by account, independently of challenge replacement.
Verification locks the account, rechecks challenge expiry and token version,
then consumes the challenge and/or recovery code in the caller's transaction.

A recovery code does **not** immediately issue tokens. It is consumed and replaced
by a fresh restricted enrollment challenge so the user can register a replacement
authenticator. The previous authenticator remains active until the new code is
confirmed; confirmation invalidates all old recovery codes and sessions and
returns ten new recovery codes. If that response is lost, restart with the old
authenticator or another unused recovery code. Password resets/changes invalidate
pending login/enrollment challenges, but never remove the active authenticator or
its recovery codes. If both the authenticator and all recovery codes are lost,
recovery requires trusted database administration; email password recovery alone
does not bypass 2FA.

The legacy `odbAuth.login()` rejects password-only authentication with
`TWO_FACTOR_REQUIRED` while 2FA is enabled. Application and sandbox login endpoints
use `beginLogin()` instead.

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

`require_user` rejects empty JWT segments and requires a verified signature before
decoding the payload. Malformed base64url, invalid or duplicate-key JSON, missing
or wrongly typed claims, and claim values that exceed database column limits
raise the standard `UNAUTHORIZED` error (HTTP 401 in generated handlers), not
Oracle parsing/value errors. Required claims are non-empty strings (`iss`, `sub`,
`sid`) and integer JSON numbers (`exp`, `ver`); numeric strings are not coerced.
Configuration-loading and session/user lookup failures remain server errors rather
than being disguised as invalid credentials.

### Deployment boundary

Changing the signing key invalidates existing access-token signatures after
cached configuration refreshes. There is no key-rotation workflow, overlapping
old-key verification, or `kid` key ring in setup.
Issuer changes likewise invalidate tokens carrying the previous issuer after
the cache refresh. Expiration changes affect newly issued tokens, not the `exp`
already signed into existing tokens.

The sandbox Settings API masks the key and rejects writes/removals of
all `AUTH_*` keys; use trusted setup or direct authorized database administration.
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

### Profile and password changes

`odbAuth.readProfile(userId, avatarUrl, avatarUploaded, passwordConnected, googleConnected, avatarId)`
reads the Google photo URL, uploaded storage key and actual identity counts. The application exposes these
through `/auth/state`; the three numeric status fields are `0` or positive counts.
An uploaded avatar takes precedence over a Google photo. `readUser` remains unchanged.

`odbAuth.updateAvatar(userId, avatar)` accepts a JPEG thumbnail data URL of at most
30,000 characters, or `NULL` to remove the upload. The web app produces a cropped,
metadata-free 128 x 128 JPEG from JPEG, PNG or WebP input of at most 5 MB. The data URL
is only an upload transport: the database validates its size, base64 shape and JPEG
signature, decodes it and writes binary content with MIME type `image/jpeg` through
`odbStorage`. `odb_auth_users.avatar` is a nullable storage key, not a CLOB.
SVG, arbitrary remote upload URLs and active formats are rejected.
Replacement and removal delete the previous object under the account lock in the same transaction.
The storage foreign key clears the reference if the object is deleted through Storage.
Authenticated `GET /auth/avatar/:id` serves only the enabled owner's current avatar,
with private/no-store caching and `nosniff` headers. The web client fetches it with bearer
authentication and displays a temporary blob URL, revoked on replacement or sign-out.
No avatar keys are made publicly readable.
Trusted `updateGoogleAvatar(subject, picture)` is called only after Google token verification
and successful sign-in; only HTTPS `lh<N>.googleusercontent.com` photo URLs are accepted,
and uploaded photos are never replaced. The optional verified `picture` claim needs no
additional Google scope or server-side image download.

`odbAuth.changePassword(userId, currentPassword, password)` rate-limits attempts per
user and locks the enabled account before verifying its local password. It rejects
Google-only users, checks the existing 8-256-character password policy, hashes the new
password, increments the access-token version, revokes all refresh sessions and deletes
outstanding password recovery tokens in the caller's transaction. It does not issue a
replacement session or commit the change. The authenticated application service binds
the user ID from the verified bearer token, validates repeat-password confirmation and
expires the refresh cookie; it never accepts a caller-supplied target user.

Profile columns, auth/Google runtime procedures and application services are included
in the bootstrap migration. Rebuild and redeploy the database to install them; no
separate incremental profile migration is supplied.

The bootstrap migration (`apps/db/src/migrations/00000000000000-bootstrap.ts`)
installs `pck_app`, which exposes these endpoints beneath `/auth`. `odbAuth` does
not register them; the application package does. The sandbox retains duplicate
login, refresh, logout, and `me` procedures under `/sandbox/auth`, without
overwriting the application's public routes.

| Endpoint                       | Purpose                                                                                                                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/login`             | Accepts `{ username, password }`; returns `{ accessToken, challenge, setupSecret }`. With 2FA enabled, only the restricted challenge (and setup key for enrollment) is populated; no refresh cookie is issued.                                     |
| `POST /auth/two-factor/verify` | Accepts `{ challenge, code }`. Successful TOTP returns an access token, refresh cookie, and recovery-code array (ten on enrollment, otherwise empty). A recovery code instead returns a replacement enrollment challenge/setup key without tokens. |
| `POST /auth/signup`            | Accepts JSON `{ email, fullName, password, passwordRepeat }`, creates an inactive account, and sends a confirmation email.                                                                                                                         |
| `POST /auth/confirm-email`     | Accepts JSON `{ token }`, consumes an unexpired confirmation token, and enables the account without creating a session.                                                                                                                            |
| `POST /auth/recover-password`  | Accepts JSON `{ email }` and sends a reset link for an active account; unknown or disabled accounts receive the same empty success response.                                                                                                       |
| `POST /auth/reset-password`    | Accepts JSON `{ token, password, passwordRepeat }`, changes the password, and revokes existing sessions without logging in.                                                                                                                        |
| `POST /auth/refresh`           | Rotates the refresh cookie and returns `{ accessToken }`.                                                                                                                                                                                          |
| `POST /auth/logout`            | Revokes the browser session and expires the refresh cookie.                                                                                                                                                                                        |
| `GET /auth/state`              | Returns `{ user, providers: { password, google }, signup, twoFactor }`; `user` is null without credentials and contains the profile, roles, and permissions for a valid bearer token.                                                              |

The web client's `auth.getState()` loads both the current identity and public
authentication capabilities. `auth.providers`, `auth.signupEnabled`, and `auth.twoFactorEnabled` are reactive
refs, initially null until state has loaded. Startup restoration attempts
`POST /auth/refresh`, then loads `/auth/state` even when no refresh session exists.
Login and profile updates also reload state; Google buttons reuse the shared
capabilities instead of making a separate configuration request.

`/auth/state` emits native JSON objects and booleans, not JSON strings:

```json
{
  "user": null,
  "providers": { "password": true, "google": true },
  "signup": true,
  "twoFactor": true
}
```

The service declares `responseMediaType: 'application/json'` with JSON-typed
response fields. Its generated PL/SQL handler validates and streams the JSON,
preserving `Cache-Control: no-store`. SQL query handlers can use `"{}name"`
aliases for embedded JSON; PL/SQL OUT parameters need explicit JSON output.

`/auth/state` returns 200 for anonymous callers and sets `Cache-Control: no-store`.
A supplied invalid, expired, or malformed bearer credential still returns 401,
allowing the client's normal refresh handling. It replaces the public `/auth/me`
and `/auth/google/config` endpoints. Rebuild and redeploy bootstrap to install
the updated routes; no incremental migration is supplied.

The state procedure uses SQL `NUMBER` locals for profile flags passed to
`JSON_OBJECT`. Oracle 19c rejects PL/SQL `PLS_INTEGER` inputs to JSON generation
with `ORA-40654`, leaving the package body invalid and the endpoint returning 500.

### Email signup

Redeploy the database from the reorganized bootstrap migration; this change
does not supply an incremental signup migration. Bootstrap installs the auth
confirmation table and all application authentication endpoints together in
`pck_app`, after the framework packages and settings. The signup page is available
at `/signup`, linked from Login. Google sign-in is available separately when
explicitly enabled through trusted setup.

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

## Google sign-in

Google authentication uses a backend-owned OpenID Connect authorization-code
flow with PKCE (S256), state, and nonce. The Login and Signup pages read shared
`GET /auth/state` capabilities and show **Continue with Google** only when
`providers.google` is true.
The public client ID is not proof of identity and is not a password. No Google
script, ID token, or client secret is needed in the frontend.

| Endpoint                       | Contract                                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/google/start`      | Accepts `{ "redirect": "/local/path" }`, requires the configured application Origin, sets a five-minute HttpOnly transaction cookie, and returns `{ "authorizationUrl": "https://accounts.google.com/..." }`.                                                                    |
| `GET /auth/google/callback`    | Accepts Google's `state`, `code`, or `error` and consumes the browser-bound transaction. Its stored purpose determines login or linking. Login success sets the normal refresh cookie and redirects to Login; linking returns to Account settings without replacing the session. |
| `POST /auth/google/link/start` | Requires an authenticated access token, the current refresh cookie, the configured Origin, and `{ "redirect": "/account", "password": "<current password>" }`. Starts explicit linking and returns the Google authorization URL.                                                 |

The callback must be exposed through the browser-facing deployment and registered
**exactly** in the Google Cloud OAuth client's authorized redirect URIs.
Use a Web application OAuth client and configure its consent screen. The
callback must reach the ORDS endpoint, not a SPA fallback. `ov ss` constructs
and prints the registered redirect URI automatically:

- **Development:** a loopback `APP_PUBLIC_URL` plus `/api/auth/google/callback`,
  for example `http://localhost:5173/api/auth/google/callback`, using Vite's API proxy.
- **Production:** the current environment's `runtime.apiUrl` plus
  `/auth/google/callback`, for example
  `https://api.example.com/ords/app/auth/google/callback`. This is the same API
  base used to configure `VITE_API_URI`, so an external ORDS endpoint does not
  require an app-origin proxy. A runtime API base ending in `/api/` also works
  for a production same-origin proxy.

Trailing slashes are normalized and the API's existing base path is retained.
Sign-in and linking share this one callback and the `AUTH_GOOGLE_REDIRECT_URI`
setting. `ov ss` provisions and prints one URI, which needs only one registration
in Google Cloud. The callback dispatches using the purpose in the consumed
server-side transaction, never a caller-supplied purpose or user ID.
Keep `APP_PUBLIC_URL` consistent with the application's browser
origin. Use HTTPS in production; HTTP is allowed only for explicit loopback
development URLs. The transaction and refresh cookies always use Secure,
HttpOnly, SameSite=Lax, Path=/, and the `__Host-` prefix.

### Settings and manual deployment

Code generation and TypeScript compilation do not install these changes.
Apply the database artifacts and schema grants yourself. The bootstrap
migration installs `odb_google`, its transaction table, the provider identity
table, local password identities, transaction purpose and session bindings, and
the login and linking endpoints. Google linking is part of the TypeScript-defined
bootstrap; redeploy the database from that bootstrap rather than applying a
separate linking migration. The TypeScript builders generate the database
artifacts; no handwritten linking upgrade PL/SQL is required. The existing
sign-in callback URI is also used for connecting accounts; no second setting
or Google Cloud callback registration is needed. A legacy link callback setting,
if present, is unused. Redeploy the updated `odb_google` and application
artifacts before using the shared flow.

`ov ss` / `ov setup settings` supports these case-insensitive JSON settings:

```json
{
  "auth_google_enabled": true,
  "VITE_GOOGLE_CLIENT_ID": "<your-client-id>.apps.googleusercontent.com",
  "auth_google_client_secret": "<provision outside source control>"
}
```

These keys supplement the existing SMTP/JWT/application settings file.
`VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`, and `AUTH_GOOGLE_CLIENT_ID`
are aliases for the **database** client-ID setting; specifying more than one
alias is rejected. A frontend `.env` entry alone does not enable Google login.
Never put the client secret in a `VITE_*` variable.

Do not supply `AUTH_GOOGLE_REDIRECT_URI`
in JSON or enter them at a prompt.
They are internal database settings written by `ov ss` after deriving the
callbacks from the existing URLs. JSON files containing either key are
rejected with removal guidance. For a non-loopback application URL, the
environment must have a valid HTTPS `runtime.apiUrl`; missing or unsafe URLs
fail before any database connection. Re-run setup after changing either base URL,
and register each environment's exact printed callbacks in Google Cloud.

Google is allowed by default (`AUTH_GOOGLE_ENABLED=Y`), but remains unavailable with an empty client ID
and client secret. Enabled setup requires your client ID, client secret, and
valid existing application/API URLs, stores the secret encrypted with `secret=Y`, and grants
HTTPS network ACL access only to `oauth2.googleapis.com:443` and
`www.googleapis.com:443`. Disabled setup preserves previously provisioned Google
credentials. The sandbox Settings API rejects writes/removals of both
all `AUTH_*` keys; use trusted provisioning.

Google setup asks only whether to enable sign-in, the client ID, and the
client secret. The callback is derived and HTTPS ACLs are provisioned automatically.
Outbound HTTPS uses database-managed TLS trust; there is no application wallet
path setting or prompt. Remove `AUTH_GOOGLE_WALLET_PATH` from older JSON files;
any existing database value is unused and need not be removed to deploy.
Missing trust or unavailable endpoints fail explicitly, without bypassing TLS
verification. Use the production Settings master-key provider for client-secret encryption.

### Identity and session policy

An application account is distinct from its login methods:

| Table                 | Responsibility                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `odb_auth_users`      | Stable user ID, account email (`username`), display name, enabled state, and token version. No password hash or provider subject. |
| `odb_auth_identities` | Account reference, issuer, subject, and an optional password hash for local credentials only.                                     |

Accounts are unique by `LOWER(TRIM(username))`. Registration and password login
use the same trim-and-lowercase normalization; Gmail-specific dot or plus-address
rewriting is not performed. Local identities use the reserved issuer `password`
and the normalized username as subject. There is at most one password identity
per user. Federated identities have no password hash and are globally unique
by `(issuer, subject)`. A user can have both a password identity and Google
identities, all reaching the same account, roles, data, and sessions.

This schema is installed by rebuilding the database with the updated bootstrap
migration. There is no additional application migration or legacy `odbAuth.upgrade()`
API. Rebuilding removes existing data; preserving data from an older schema requires
a separately planned migration.

Only a server-verified Google identity can reach the trusted
`odbAuth.loginGoogle` primitive. Google tokens are verified using Google's
RSA signing keys, the configured audience, issuer, timestamps, nonce, and
verified email. Signing-key retrieval is bounded and cached briefly; token
headers cannot choose a key URL. The existing HS256 verifier is used only for
the application's own access tokens.

Provider identities are unique by canonical issuer plus subject. Email is an
attribute, not an identity key. Known identities retain their internal user ID
even if their Google email changes. Disabled users remain disabled. New
Google-only users have no local password and no roles. They cannot use password
login or password recovery/reset to silently establish a password.

An email collision with any existing local account is rejected; signup,
confirmation state, password, and account enablement are not overwritten.
There is no automatic linking or account merge. On a Google email collision,
the callback preserves the requested local destination and sends the browser
through existing-account login to **Account settings**. The user can choose
**Connect Google**, confirm their current password, and complete a fresh Google
authorization. Successful linking continues to the original validated local
destination. Cancellation or failure stays on Account settings for retry;
**Continue without connecting** skips linking without changing identities.
The original Google token/subject is not retained for deferred linking, and a
matching email or a redirect query never authorizes attaching an identity.
Password users can also start this flow directly from Account settings.
The Google email need not match the local account email: the explicit,
authenticated transaction authorizes linking, not email equality.

Linking uses its own five-minute OIDC transaction bound to the initiating
user and session. It retains state, browser-cookie binding, nonce, PKCE, and
single-use consumption. A revoked, expired, or changed session cannot complete
the link. Both purposes return through the same callback; its purpose is read
only from the consumed transaction. State, nonce, PKCE, browser binding, and the
link-session checks prevent substituting a login transaction for a linking proof.
The verified Google issuer and subject are attached to the existing user without
changing their email, password, roles, or application session. Reconnecting the
same identity to the same user is idempotent; an identity belonging to another
user is rejected, including concurrent attempts. Unlinking is not provided.

Successful Google authentication shares the existing application session
creation, JWTs, refresh rotation, and revocation controls with password login.
Google access/refresh tokens are not retained. No application tokens appear in
redirect URLs or browser storage. Transactions are single-use, including
cancellation, and expire after five minutes. Start/callback requests are rate
limited by `odbGoogle.start` and `odbGoogle.complete`, including direct PL/SQL
calls. The framework also owns reading and validating `APP_PUBLIC_URL` through
`odbGoogle.publicUrl()`. The application retains Origin checks, cookies, HTTP
routes and responses, redirect destinations, and error-to-UI mapping.
Audit events do not include credentials, authorization codes, or tokens.

The Google runtime is authored with TypeScript package/query builders, including
HTTP lifecycle, JSON validation, key assembly, and claim checks. Small Oracle ports
wrap `UTL_HTTP`, `UTL_URL`, and the in-memory JSON types; existing crypto, encoding,
and LOB ports are reused. Deployment still generates PL/SQL for Oracle execution;
there is no additional JavaScript service or runtime.
The TypeScript `odbGoogle.start()` call renders `odb_google.start_login(...)`;
`START` is reserved in PL/SQL and is not used as a procedure name.
JSON member-presence checks use the object's key list, because Oracle 19c's
`has()` can raise for absent optional fields under strict error handling.
Required values and their types are still validated strictly.
RSA signing keys are assembled as DER SubjectPublicKeyInfo and passed to Oracle's
verifier as Base64-encoded bytes without PEM headers. This representation was
verified on Oracle 19.28 using synthetic valid and tampered signatures.

Local SQL-generation and mocked frontend/CLI tests do not establish successful
Oracle package compilation or live Google login. After manual deployment,
verify Oracle's RSA verification support, outbound HTTPS access, callback routing,
and complete login and linking/cancellation/replay round trips in the target environment.
Configure reverse-proxy and ORDS access logging to redact callback query
parameters (especially authorization codes and state). The callback sends
`Referrer-Policy: no-referrer` and authentication responses use `Cache-Control:
no-store`.

## Procedures

| Procedure          | Parameters                                                             | Behavior                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login`            | `p_username`, `p_password` IN; `p_access_token`, `p_refresh_token` OUT | Legacy password-only entry point; rejects with `TWO_FACTOR_REQUIRED` while 2FA is enabled. Use `beginLogin` and `verifyTwoFactor` for the two-stage flow. |
| `refresh`          | `p_refresh_token` IN; `p_access_token`, `p_next_refresh_token` OUT     | Rotates the refresh token. Reuse of a rotated token revokes the session.                                                                                  |
| `logout`           | `p_refresh_token` IN                                                   | Revokes the session; unknown or empty tokens are ignored.                                                                                                 |
| `recover_password` | `p_username` IN; `p_reset_token` OUT                                   | Returns a one-hour token for an enabled account, otherwise NULL. The trusted application sends the email.                                                 |
| `reset_password`   | `p_token`, `p_password` IN                                             | Consumes a recovery token, changes the password, increments token version, and revokes sessions. Invalid tokens/passwords raise `VALIDATION_ERROR`.       |
| `read_user`        | `p_user_id` IN; `p_username`, `p_display_name` OUT                     | Reads an enabled user; raises `NOT_FOUND` otherwise.                                                                                                      |
| `require_user`     | `p_access_token` IN                                                    | Returns the user id behind a valid access token; raises `UNAUTHORIZED` otherwise.                                                                         |

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

// Password login: send the challenge/setup key to the browser when 2FA is required.
body.call(odbAuth.beginLogin(username, password, accessToken, refreshToken, challenge, setupSecret))
body.ifThen(cond.isNotNull(refreshToken), (authenticated) =>
  authenticated.set(setCookie, refreshCookie.set(refreshToken)),
)

// refresh
body.call(odbAuth.refresh(refreshCookie.read(cookie), accessToken, nextRefreshToken))
body.set(setCookie, refreshCookie.set(nextRefreshToken))

// logout
body.call(odbAuth.logout(refreshCookie.read(cookie)))
body.set(setCookie, refreshCookie.expire())
```

Reuse `odbAuth.types` (`username`, `password`, `accessToken`, `refreshToken`, `userId`, `displayName`) for parameters instead of redeclaring them. Install `odbAuth` after `odbRateLimit`, `odbSettings`, `odbLob` and `odbStorage`; login throttling uses Rate Limit, JWT configuration uses Settings, and avatars use LOB decoding and Storage.

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

const challenge = await auth.login({ username: 'ada', password: 'correct horse battery staple' })
if (challenge) {
  // Render enrollment when setupSecret is present; otherwise request a TOTP/recovery code.
  // Submit the entered code with auth.verifyTwoFactor(challenge.challenge, code).
  // Handle a replacement enrollment challenge or show returned recoveryCodes before navigating.
}

if (auth.authenticated.value) {
  console.log(auth.user.value?.username)
}
```

Login and refresh requests include browser credentials so ORDS can set and receive the refresh cookie. Set `http.openapi` to the generated database OpenAPI document, as the sandbox configuration does. The HTTP client supplies the token only to documented bearer operations, skips anonymous and unknown operations, and refreshes/retries a protected request once after a 401. It never refreshes on 403 or automatically sends tokens to absolute URLs. Without a document, ordinary relative requests retain legacy bearer behavior, except login, refresh, and logout. Keep the application on HTTPS in production: the default `__Host-odb_refresh` cookie is `Secure`, `HttpOnly`, and `SameSite=Lax`.
