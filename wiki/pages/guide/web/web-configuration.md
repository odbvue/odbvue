# Web Configuration

`apps/web/odbvue.config.ts` configures the **web application**, not the database installation. `src/main.ts` explicitly installs Vue I18n, Pinia, Vuetify, and the router, then mounts immediately. All web code belongs to `apps/web`; there is no separate web framework package, service container, event bus, or capability registry.

```ts
import type { AppConfig } from './src/capabilities/config'

export default {
  title: 'OdbVue',
  version: '1.0.0',
  ui: {},
} satisfies AppConfig
```

## Configuration areas

| Area     | Purpose                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------- |
| `auth`   | Authentication endpoint overrides and application login, authenticated, and forbidden routes.     |
| `http`   | HTTP defaults and the generated OpenAPI document used for request security and response decoding. |
| `i18n`   | Supported locales, browser-language detection, and translation options.                           |
| `errors` | Error buffering and application reporters.                                                        |
| `ui`     | Application theme, component defaults, icon aliases, and advanced Vuetify options.                |

`title` and `version` supply application metadata. Configuration describes application choices; it does not enable database features or dynamically register web capabilities.

## Runtime access

Components and composables can read application configuration with `useAppConfig()` and access services through focused composables. These return ordinary application-scoped ES module instances and do not require an injection context. Module diagnostics derive module names from discovered page metadata rather than configuration.

```ts
import { useAppConfig } from '@/capabilities/config'
import { useAuth } from '@/capabilities/auth'

const config = useAppConfig()
const auth = useAuth()
```

Application-specific behavior should remain in application source files. Do not put business rules into the configuration object.

Bootstrap installs the application instances directly. There is no generic readiness promise or startup hook. The router guard lazily restores authentication; mounting does not wait for auth or router readiness.

```ts
import { createApp } from 'vue'
import App from '@/app/App.vue'
import { pinia } from '@/capabilities/state'
import { i18n } from '@/capabilities/i18n'
import { vuetify } from '@/capabilities/ui'
import router from '@/app/router'

const app = createApp(App)
app.use(pinia)
app.use(i18n)
app.use(vuetify)
app.use(router)
app.mount('#app')
```

Use `useAuth()` directly rather than wrapping it in an application store or adding another initialization watcher. Authentication refs use `.value` in scripts; when accessed as properties of the `auth` object, use `.value` in templates too. Login/logout errors are thrown to the caller so application UI can present localized feedback.

## Authentication

On initial navigation, the authentication guard sends the refresh cookie to `/auth/refresh`; when that succeeds it fetches `/auth/me`. Auth's idempotent `restore()` shares one promise across concurrent calls and subsequent navigations, including restoration failures. The reactive auth `ready` flag controls login UI, not bootstrap. The HTTP service adds the access token to protected requests and refreshes it when needed. Set `http.openapi` to the generated database OpenAPI document to distinguish protected operations from anonymous ones.

Vue and router errors are captured explicitly in `main.ts`, and HTTP errors use an `onError` callback. Error reporting is separate from user notifications: user-facing flows decide when to show localized feedback.

```ts
import { useAuth } from '@/capabilities/auth'

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
