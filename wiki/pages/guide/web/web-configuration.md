# Web Configuration

`apps/web/odbvue.config.ts` configures the **web application runtime**, not the database installation. It is installed before the web app mounts, and `@odbvue/web` makes it available to framework code and composables. Use the components and composables your application needs from `@odbvue/web`.

```ts
import { defineOdbVueApp } from '@odbvue/web'

export default defineOdbVueApp({
  ui: {},
  integrations: {},
  hooks: {},
  modules: [],
})
```

## Configuration areas

| Area           | Purpose                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `auth`         | Optional overrides for authentication endpoint URLs; authentication is available by default.      |
| `http`         | HTTP defaults and the generated OpenAPI document used for request security and response decoding. |
| `i18n`         | Supported locales, browser-language detection, and translation options.                           |
| `errors`       | Error buffering and application reporters.                                                        |
| `ui`           | Application theme, component defaults, icon aliases, and advanced Vuetify options.                |
| `integrations` | Application choices for external providers.                                                       |
| `hooks`        | Reserved extension points for application-specific behavior.                                      |
| `modules`      | Reserved registration point for business modules.                                                 |

`title`, `version`, and `preset` are also available for application metadata and future composition. Use only documented, stable fields; configuration is intentionally the boundary between an application and the framework implementation.

## Runtime access

Components and composables can read the installed configuration with `useOdbVueConfig()` and access services through their composables.

```ts
const config = useOdbVueConfig()
const auth = useAuth()
```

Application-specific behavior should remain in application source files. Do not put business rules into the configuration object.

## Authentication

At startup, the authentication service sends the refresh cookie to `/auth/refresh`; when that succeeds it fetches `/auth/me`. The HTTP service adds the access token to protected requests and refreshes it when needed. Set `http.openapi` to the generated database OpenAPI document to distinguish protected operations from anonymous ones.

```ts
import { useAuth } from '@odbvue/web'

const auth = useAuth()

await auth.login({ username: 'ada', password: 'correct horse battery staple' })
await auth.me()
await auth.logout()
```

`login()` and `refresh()` receive only an access token in the response body. The refresh token is an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, so browser requests must remain on a compatible HTTPS origin. Override the default `/auth/login`, `/auth/refresh`, `/auth/logout`, and `/auth/me` routes with `auth: { endpoints: { ... } }` when necessary.

## Database Installation

The database bootstrap installs all shipped database capabilities explicitly through migrations, including `odbHttp`, `odbRateLimit`, `odbAuth`, `odbSettings`, `odbLob`, `odbAudit`, and `odbStorage`.

```ts
defineMigration('00000000000000_bootstrap', { schema })
  .install(odbHttp)
  .install(odbRateLimit)
  .install(odbAuth)
  .install(odbSettings)
  .install(odbLob)
  .install(odbAudit)
  .install(odbStorage)
```

Web configuration never generates or installs Oracle objects. Installing database packages does not automatically expose application endpoints or configure external providers; those remain explicit application concerns.
