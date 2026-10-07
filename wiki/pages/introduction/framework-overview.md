# Framework Overview

OdbVue provides a coherent path from Oracle database schema to a Vue experience,
while applications own their domain and visual identity.

```text
Oracle Database -> ORDS/OpenAPI -> Vue application
```

## Framework components

- `@odbvue/odb` models, builds, migrates, and executes work against Oracle.
- `@odbvue/odb-oracledb` supplies the Oracle execution adapter.
- ORDS exposes the deployed database contract; ODB emits its OpenAPI manifest.
- `ov` coordinates database and generated-client workflows.
- `apps/web` contains the complete Vue/Vuetify application and its shared UI.

Framework packages are developed together. The Vue application is private
workspace source, not another independently versioned SDK.

## Ownership boundary

Oracle tooling and the CLI provide reusable framework behavior. The web application
owns its Vue plugin composition, authentication, HTTP client, routing, persistence,
translations, UI, pages, and themes.

The main application lives in `src/app`, domain modules in `src/modules`, and
shared components in `src/components`. Modules use app composables and shared UI
without registering runtime contracts or importing other modules' internals.

## Composition

`odbvue.config.ts` describes application choices. Explicit setup in
`src/app/plugins` installs Pinia, Vue I18n, Vuetify, and application-scoped services.
It restores authentication once; both mounting and routing await the same startup
promise. Database capabilities are installed explicitly through migrations and
are not enabled by web configuration.

## Web features

The application retains file-based pages, rich route metadata, navigation,
breadcrumbs, authentication guards, HTTP refresh/retry handling, persistence, and
shared forms, tables, charts, maps, and other components.

- [Web Overview](/guide/web/setting-up-vuejs) explains the source boundaries.
- [Routing](/guide/web/capabilities/routing) describes metadata-driven pages,
  navigation, breadcrumbs, titles, and authorization.
