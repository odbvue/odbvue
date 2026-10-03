# Framework Overview

OdbVue is a framework for Oracle-backed business applications. It provides a coherent path from database schema to generated web client, while applications keep ownership of their domain and visual identity.

```text
Oracle Database -> ORDS/OpenAPI -> @odbvue/web -> application
```

## Framework components

- `@odbvue/odb` models, builds, migrates, and executes work against Oracle.
- ORDS exposes the deployed database contract; ODB emits its OpenAPI manifest.
- `@odbvue/web` provides the web runtime, OdbVue configuration, and Vuetify setup.
- `ov` coordinates common database and generated-client workflows.

The OdbVue release is the compatibility unit. Framework packages are developed and released together rather than as independently versioned application features.

## Ownership boundary

OdbVue owns reusable runtime behavior: Vue and Vuetify setup, configuration access, database tooling, generated-client workflow, and framework defaults.

An application owns its business pages, domain components, database migrations, translations, themes, and the choices declared in `odbvue.config.ts`. A setting belongs in application code when it is specific to that application; it belongs in OdbVue when every application would otherwise need to assemble the same plumbing.

## Composition

`odbvue.config.ts` is the application-level registration point. It selects capabilities and integrations, supplies UI customizations, and will compose business modules as the module API becomes stable. OdbVue then applies those choices to its runtime without generating framework files for the application to maintain.

## Framework capabilities

Capabilities are reusable framework behavior exposed by OdbVue packages. They give applications a shared implementation and contract while leaving application pages, domain rules, and presentation in application code.

The web runtime includes capabilities for configuration, errors, HTTP, internationalization, state, UI, and routing. Some capabilities are enabled or configured in `odbvue.config.ts`; routing is always available when an application uses the OdbVue web runtime and Vue Router.

- [Routing](/guide/web/capabilities/routing) turns generated Vue Router records into typed, metadata-rich pages that application shells can use for navigation, breadcrumbs, titles, and page-aware UI.

Capabilities expose framework-level information and operations. They do not replace application-specific authorization or business logic.
