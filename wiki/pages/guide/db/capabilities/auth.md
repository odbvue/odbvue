# Authentication

`odbAuth` is an installable authentication capability for ORDS applications. It creates users and sessions, hashes passwords with PBKDF2-SHA512, issues short-lived access JWTs, and keeps rotating refresh tokens in an `HttpOnly` cookie.

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

The migration registers these endpoints beneath `/auth`:

| Endpoint             | Purpose                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST /auth/login`   | Accepts JSON `{ username, password }`, sets the refresh cookie, and returns `{ accessToken }`.       |
| `POST /auth/refresh` | Rotates the refresh cookie and returns `{ accessToken }`.                                            |
| `POST /auth/logout`  | Revokes the browser session and expires the refresh cookie.                                          |
| `GET /auth/me`       | Requires `Authorization: Bearer <access token>` and returns `userId`, `username`, and `displayName`. |

The access token is valid for 15 minutes. Refresh tokens are opaque, are stored only as hashes in the database, expire after 30 days, and rotate on every refresh. Revoking a session, disabling a user, or changing its token version invalidates existing access tokens.

Authentication failures use ORDS HTTP error responses, including `401 INVALID_CREDENTIALS` for invalid logins and `401 UNAUTHORIZED` for expired, revoked, or malformed sessions.

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
