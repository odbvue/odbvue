# Web Overview

OdbVue's web experience is an ordinary Vue application in `apps/web`, using Pinia,
Vue Router, Vue I18n, and Vuetify. It is application-owned source, not a separately
published web SDK.

The layout combines the conventional Vue folders from release/v0 with explicit
main-application and module boundaries:

```text
apps/web/
  odbvue.config.ts           # Application choices
  plugins/                  # Node-only Vite plugins
  test/                     # Infrastructure and shared component tests
  e2e/                      # Browser tests
  src/
    main.ts                 # Bootstrap and mount
    app/
      App.vue               # Main application shell
      pages/                # Main routes: /, /login, /about, 404
      layouts/
      composables/
      auth/                 # Reactive, in-memory session
      errors/
      http/
      i18n/                 # Vue I18n setup and application messages
      network/
      plugins/              # Explicit application plugin installation
      router/               # Router, guards, manifest and navigation
      state/                # Pinia and persistence
      ui/                   # Vuetify, feedback and preferences
      themes/
      services/             # Generated ORDS/OpenAPI types
    components/             # Shared VOv* components and types
    modules/
      sandbox/
        catalog.ts          # Sandbox diagnostics, not a runtime registry
        pages/              # /sandbox and child routes
        i18n/
```

Modules can add their own components, composables, stores, API calls, and
translations alongside their pages. Keep module-specific behavior inside its
module. Share UI through `src/components` and app services through focused
composables such as `useAuth()`, `useHttp()`, and `useUi()`. Application
infrastructure must not depend on sandbox.

`src/app/plugins` explicitly composes the libraries and services. A typed Vue
injection shares application-scoped dependencies; there are no dynamic contracts,
capability ordering, module registries, or service-aggregation Pinia stores.
Pinia remains the implementation for preferences and UI state. Auth is already a
reactive composable, so it needs no second store.

Vite generates file routes, module metadata, translations, icon aliases,
auto-imports, components, and OpenAPI types. Shared Vue components compile directly
with the app; no component-library build is needed.

Start with [Web Configuration](/guide/web/web-configuration), then
[Routing and Pages](/guide/web/file-based-routing) and
[Routing](/guide/web/capabilities/routing).
