# Authentication

`odbAuth` is a database capability, not an HTTP service. It installs the `odb_auth_users` and `odb_auth_sessions` tables and the `odb_auth` PL/SQL package, hashes passwords with PBKDF2-SHA512, issues short-lived access JWTs, and rotates opaque refresh tokens. The package has no ORDS routes, reads no headers or cookies, and raises standard ODB errors; the application decides how tokens travel and how failures look on the wire.

## Capability vs service

`odbAuth` owns:

- the user and session schema;
- password hashing and verification;
- access-token and refresh-token primitives;
- `login`, `refresh`, `logout`, `read_user`, and `require_user`;
- standard ODB errors (`UNAUTHORIZED`, `NOT_FOUND`, `TOO_MANY_REQUESTS`).

The application owns:

- login, refresh, logout, and `me` endpoints and their shapes;
- reading `Authorization` and `Cookie` headers and writing `Set-Cookie`;
- authorization policy (who may call what);
- mapping ODB errors to HTTP responses.

The test for placement: would another PL/SQL package reasonably call this without HTTP? If yes, it belongs in `odbAuth`; if it concerns headers, cookies, status codes, or endpoint shape, it belongs in the application.

## Install

Install it through a migration. Provide a unique production secret of at least 32 characters with `ODBVUE_AUTH_JWT_SECRET`; the built-in secret is for local development only.

```ts
import { defineMigration, odbAuth } from '@odbvue/odb'

const schema = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('20260913120000_auth', { schema })
  .install(odbAuth)
  .install(
    odbAuth.seedUser({
      username: 'admin',
      password: process.env.ODBVUE_ADMIN_PASSWORD ?? 'change-me',
      displayName: 'Administrator',
    }),
  )
```

`seedUser()` is idempotent. Use a real secret manager for the initial password in deployed environments.

## HTTP Contract

The sandbox migration (`apps/db/src/migrations/00000000000001-sandbox.ts`) exposes these endpoints beneath `/auth`. `odbAuth` does not register them; the application package does:

| Endpoint             | Purpose                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST /auth/login`   | Accepts JSON `{ username, password }`, sets the refresh cookie, and returns `{ accessToken }`.       |
| `POST /auth/refresh` | Rotates the refresh cookie and returns `{ accessToken }`.                                            |
| `POST /auth/logout`  | Revokes the browser session and expires the refresh cookie.                                          |
| `GET /auth/me`       | Requires `Authorization: Bearer <access token>` and returns `userId`, `username`, and `displayName`. |

The access token is valid for 15 minutes. Refresh tokens are opaque, are stored only as hashes in the database, expire after 30 days, and rotate on every refresh. Revoking a session, disabling a user, or changing its token version invalidates existing access tokens.

Authentication failures raise ODB errors that ORDS maps to HTTP responses, including `401 INVALID_CREDENTIALS` for invalid logins and `401 UNAUTHORIZED` for expired, revoked, or malformed sessions.

## Procedures

| Procedure      | Parameters                                                             | Behavior                                                                                         |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `login`        | `p_username`, `p_password` IN; `p_access_token`, `p_refresh_token` OUT | Verifies credentials, opens a session. Raises `UNAUTHORIZED` (`INVALID_CREDENTIALS`) on failure. |
| `refresh`      | `p_refresh_token` IN; `p_access_token`, `p_next_refresh_token` OUT     | Rotates the refresh token. Reuse of a rotated token revokes the session.                         |
| `logout`       | `p_refresh_token` IN                                                   | Revokes the session; unknown or empty tokens are ignored.                                        |
| `read_user`    | `p_user_id` IN; `p_username`, `p_display_name` OUT                     | Reads an enabled user; raises `NOT_FOUND` otherwise.                                             |
| `require_user` | `p_access_token` IN                                                    | Returns the user id behind a valid access token; raises `UNAUTHORIZED` otherwise.                |

Tokens are plain values. Use `odbHttp.bearerToken(authorization)` and `odbHttp.defineCookie(...)` in the application package to move them through headers and cookies:

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

// any protected service
body.set(subject, odbAuth.requireUser(odbHttp.bearerToken(authorization)))
```

Reuse `odbAuth.types` (`username`, `password`, `accessToken`, `refreshToken`, `userId`, `displayName`) for parameters instead of redeclaring them. Install `odbAuth` after `odbRateLimit`; login throttling uses it.

## Browser Runtime

Enable the web capability in `apps/web/odbvue.config.ts`:

```ts
import { defineOdbVueApp } from '@odbvue/web'

export default defineOdbVueApp({ auth: true })
```

Use `useAuth()` in components and composables. `restore()` runs automatically when the capability starts; it restores the access token from the refresh cookie and then loads the current user.

```ts
import { useAuth } from '@odbvue/web'

const auth = useAuth()

await auth.login({ username: 'ada', password: 'correct horse battery staple' })
await auth.me()

if (auth.authenticated.value) {
  console.log(auth.user.value?.username)
}
```

Login and refresh requests include browser credentials so ORDS can set and receive the refresh cookie. The generated HTTP client supplies the access token on ordinary requests and refreshes it automatically after an authorization failure. Keep the application on HTTPS in production: the default `__Host-odb_refresh` cookie is `Secure`, `HttpOnly`, and `SameSite=Lax`.
