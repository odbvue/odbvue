# Web Configuration

`apps/web/odbvue.config.ts` configures the **web application**, not the database installation. Application plugins install Vue I18n, Pinia, Vuetify, and typed Vue-injected services before mounting. All web code belongs to `apps/web`; there is no separate web framework package or capability registry.

```ts
import { defineAppConfig } from './src/app/config'

export default defineAppConfig({
  ui: {},
  integrations: {},
  hooks: {},
  modules: ['sandbox'],
})
```

## Configuration areas

| Area           | Purpose                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `auth`         | Authentication endpoint overrides and application login, authenticated, and forbidden routes.     |
| `http`         | HTTP defaults and the generated OpenAPI document used for request security and response decoding. |
| `i18n`         | Supported locales, browser-language detection, and translation options.                           |
| `errors`       | Error buffering and application reporters.                                                        |
| `ui`           | Application theme, component defaults, icon aliases, and advanced Vuetify options.                |
| `integrations` | Application choices for external providers.                                                       |
| `hooks`        | Typed application startup, error, and HTTP events.                                                |
| `modules`      | Module names displayed in application diagnostics; routing is discovered from source folders.     |

`title` and `version` supply application metadata. Configuration describes application choices; it does not enable database features or dynamically register web capabilities.

## Runtime access

Components and composables can read the installed configuration with `useAppConfig()` and access services through their composables.

```ts
import { useAppConfig } from '@/app/config'
import { useAuth } from '@/app/auth'

const config = useAppConfig()
const auth = useAuth()
```

Application-specific behavior should remain in application source files. Do not put business rules into the configuration object.

`installApp()` in `src/app/plugins` returns explicit typed services with a single `ready: Promise<void>`. It resolves after session restoration and asynchronous `app:started` handlers complete. Startup failures are captured by the error service and reject readiness. Await readiness before mounting; routing guards installed with `installAppRouting()` await the same promise.

```ts
import { installApp } from '@/app/plugins'

const services = installApp(app, config, router)
await services.ready
await router.isReady()
app.mount('#app')
```

Use `useAuth()` directly rather than wrapping it in an application store or adding another initialization watcher. Authentication refs use `.value` in scripts; when accessed as properties of the `auth` object, use `.value` in templates too. Login/logout errors are thrown to the caller so application UI can present localized feedback.

## Authentication

At startup, the authentication service sends the refresh cookie to `/auth/refresh`; when that succeeds it fetches `/auth/me`. The HTTP service adds the access token to protected requests and refreshes it when needed. Set `http.openapi` to the generated database OpenAPI document to distinguish protected operations from anonymous ones.

```ts
import { useAuth } from '@/app/auth'

const auth = useAuth()

await auth.login({ username: 'ada', password: 'correct horse battery staple' })
await auth.me()
await auth.logout()
```

`login()` and `refresh()` receive only an access token in the response body. The refresh token is an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, so browser requests must remain on a compatible HTTPS origin. Override the default `/auth/login`, `/auth/refresh`, `/auth/logout`, and `/auth/me` routes with `auth: { endpoints: { ... } }` when necessary.

Application router destinations are separate from HTTP endpoints:

```ts
auth: {
  routes: {
    login: '/login',
    authenticated: '/',
    forbidden: '/',
  },
}
```

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
