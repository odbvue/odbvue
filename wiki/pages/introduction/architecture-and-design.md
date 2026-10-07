# Architecture and Design

## Architecture

**Business logic in TypeScript. Oracle as the runtime. Vue for the experience.**

```text
Oracle Database -> ORDS/OpenAPI -> Vue application
```

`@odbvue/odb` models, builds, migrates, and executes work against Oracle. ORDS
exposes the deployed database contract, which ODB emits as OpenAPI. The Vue
application consumes that contract using application-owned infrastructure.

## Repository Structure

| Path                       | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `packages/odb/`            | Oracle schema, migrations, execution, ORDS, and OpenAPI tooling           |
| `packages/odb-oracledb/`   | Oracle execution adapter                                                  |
| `packages/cli/`            | The `ov` development workflow                                             |
| `apps/db/`                 | Application-owned Oracle migrations and database artifacts                |
| `apps/web/`                | Complete Vue application, dependencies, build plugins, and tests          |
| `apps/web/src/app/`        | Main application shell, routes, services, state, and configuration access |
| `apps/web/src/modules/`    | Self-contained application modules, currently sandbox                     |
| `apps/web/src/components/` | Shared Vue UI components                                                  |

## Application Boundary

The reusable framework boundary is Oracle tooling and the CLI. Vue, Pinia, Vue
Router, Vue I18n, and Vuetify supply their own lifecycle and composition mechanisms;
the application composes them without a second capability runtime.

Within the web source, `app` describes how the main application works, `modules`
describe application domains, and `components` provides shared UI. Build-time
plugins stay outside browser source. The generated ORDS types are artifacts of
the database contract, not a hand-maintained API layer.

## Design

Design begins with the application domain: user needs, data model, and business
workflow. Model database objects with ODB, expose the required ORDS contract, then
build pages and components against generated types. Keep module-specific behavior
inside its module and extract shared behavior only when real reuse justifies it.
