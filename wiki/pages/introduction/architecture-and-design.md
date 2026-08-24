# Architecture and Design

## Architecture

OdbVue is an Oracle and Vue framework. It keeps database tooling, the generated API contract, web runtime, configuration, and CLI in one release train.

```text
Oracle Database -> ORDS/OpenAPI -> @odbvue/web -> application
```

`@odbvue/odb` models, builds, and migrates Oracle database objects. `@odbvue/odb-oracledb` executes ODB work against Oracle. ORDS exposes the deployed database contract, which ODB emits as OpenAPI. `@odbvue/web` supplies the Vue/Vuetify runtime and accepts application choices through `odbvue.config.ts`.

## Repository Structure

| Path                     | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `packages/odb/`          | Oracle schema, migrations, ORDS, and OpenAPI tooling              |
| `packages/odb-oracledb/` | Oracle execution adapter                                          |
| `packages/web/`          | Web runtime and configuration API                                 |
| `apps/db/`               | Application-owned Oracle migrations and database artifacts        |
| `apps/web/`              | Application pages, brand, generated client, and web configuration |
| `cli/`                   | The `ov` development workflow                                     |

## Application Boundary

OdbVue owns reusable infrastructure: Oracle tooling, OpenAPI generation, Vue/Vuetify initialization, configuration access, and standard runtime behavior.

The application owns business pages, components, stores, database migrations, translations, themes, and the choices in `odbvue.config.ts`. Its generated ORDS client is an artifact of the deployed database contract, not a hand-maintained API layer.

## Design

Design begins with the application domain: user needs, data model, and business workflow. Model those database objects with ODB, expose the required ORDS contract, then build pages and components against the generated client. This keeps the database and web application aligned while leaving business decisions in application-owned code.
