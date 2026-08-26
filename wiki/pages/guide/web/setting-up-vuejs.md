# Web Overview

An OdbVue web application is built with Vue and uses Vuetify for its UI, but it does not start by assembling those libraries. `@odbvue/web` provides OdbVue configuration access and the standard Vuetify runtime, including its styles, Material Design 3 blueprint, and MDI icon set.

The Web guide follows the same boundaries used by the framework:

| Area | Responsibility |
| --- | --- |
| Build | Starts an OdbVue application and connects it to generated ORDS clients. |
| Runtime | Configures and extends the installed Vue, Vuetify, i18n, state, and layout runtime. |
| Capabilities | Uses reusable framework behavior, such as routing metadata and route-derived UI state. |
| Vite | Generates pages, routes, auto-import declarations, and typed router declarations during development and builds. |

The application starts with `odbvue.config.ts`, then adds business pages, components, stores, translations, and brand choices under `src/`.

```text
apps/web/
  odbvue.config.ts     # Application-level choices
  src/
    pages/             # Business pages
    components/        # Business UI
    i18n/              # Application messages
    themes/            # Optional brand palettes and icon aliases
    services/          # Generated ORDS/OpenAPI client
```

Do not create a Vue application with `create-vue` or manually configure Vuetify for an OdbVue app. Those are framework concerns. Use the existing app as the starting point, then configure and extend it.

Start with [Web Configuration](/guide/web/web-configuration) for application choices. See [Routing](/guide/web/capabilities/routing) for the runtime routing API, and [Routing and Pages](/guide/web/file-based-routing) for the Vite-based page conventions that generate the routes.
