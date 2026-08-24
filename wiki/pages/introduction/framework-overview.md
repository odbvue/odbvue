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
