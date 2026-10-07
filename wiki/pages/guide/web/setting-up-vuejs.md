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
  test/                     # Vitest suites (*.test.ts), aligned with source
    app/                    # Main application behavior and services
    components/             # Shared components, mirroring source subfolders
    modules/                # Module-specific behavior
    plugins/                # Node-only Vite plugins
    support/                # Shared setup, stubs, and fixtures
    main.test.ts            # Bootstrap and mount
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

`src/main.ts` explicitly installs the libraries and mounts the shell immediately.
Services are ordinary application-scoped ES module instances; there are no dynamic
contracts, service containers, generic startup hooks, capability ordering, or
service-aggregation Pinia stores. The router restores auth on initial navigation.
Pinia remains the implementation for preferences and UI state. Auth is already a
reactive composable, so it needs no second store.

Vite generates file routes, module metadata, translations, icon aliases,
auto-imports, components, and OpenAPI types. Shared Vue components compile directly
with the app; no component-library build is needed.

Start with [Web Configuration](/guide/web/web-configuration), then
[Routing and Pages](/guide/web/file-based-routing) and
[Routing](/guide/web/capabilities/routing).
