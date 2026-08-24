# Web Configuration

`apps/web/odbvue.config.ts` is the registration point for application-level choices. It is installed before the web app mounts, and `@odbvue/web` makes it available to framework code and composables.

```ts
import { defineOdbVueApp } from '@odbvue/web'

export default defineOdbVueApp({
  auth: false,
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
