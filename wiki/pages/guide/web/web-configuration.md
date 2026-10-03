# Web Configuration

`apps/web/odbvue.config.ts` is the registration point for application-level choices. It is installed before the web app mounts, and `@odbvue/web` makes it available to framework code and composables.

```ts
import { defineOdbVueApp } from '@odbvue/web'

export default defineOdbVueApp({
  auth: true,
  audit: false,
  settings: false,
  storage: false,
  ai: false,
  email: false,
  ui: {},
  integrations: {},
  hooks: {},
  modules: [],
})
```

## Configuration areas

| Area           | Purpose                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capabilities   | `auth`, `audit`, `settings`, `storage`, `ai`, and `email` declare framework capabilities. Their complete web APIs will be documented as they stabilize. |
| `ui`           | Application theme, component defaults, icon aliases, and advanced Vuetify options.                                                                      |
| `integrations` | Application choices for external providers.                                                                                                             |
| `hooks`        | Reserved extension points for application-specific behavior.                                                                                            |
| `modules`      | Reserved registration point for business modules.                                                                                                       |

`title`, `version`, and `preset` are also available for application metadata and future composition. Use only documented, stable fields; configuration is intentionally the boundary between an application and the framework implementation.

## Runtime access

Components and composables can read the installed configuration with `useOdbVueConfig()`. `useCapability(name)` returns a configured capability or `undefined` when it is disabled.

```ts
const config = useOdbVueConfig()
const audit = useCapability('audit')
```

Application-specific behavior should remain in application source files. Do not put business rules into the configuration object.

## Authentication

Set `auth: true` after installing the database-side `odbAuth` migration. At startup, the capability sends the refresh cookie to `/auth/refresh`; when that succeeds it fetches `/auth/me`. The HTTP capability adds the access token to protected requests and refreshes it when needed.

```ts
import { useAuth } from '@odbvue/web'

const auth = useAuth()

await auth.login({ username: 'ada', password: 'correct horse battery staple' })
await auth.me()
await auth.logout()
```

`login()` and `refresh()` receive only an access token in the response body. The refresh token is an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, so browser requests must remain on a compatible HTTPS origin. Override the default `/auth/login`, `/auth/refresh`, `/auth/logout`, and `/auth/me` routes with `auth: { endpoints: { ... } }` when necessary.
