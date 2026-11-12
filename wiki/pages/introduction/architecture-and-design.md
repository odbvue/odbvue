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

| Path                         | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `packages/odb/`              | Oracle schema, migrations, execution, ORDS, and OpenAPI tooling         |
| `packages/odb-oracledb/`     | Oracle execution adapter                                                |
| `packages/cli/`              | The `ov` development workflow                                           |
| `apps/db/`                   | Application-owned Oracle migrations and database artifacts              |
| `apps/web/`                  | Complete Vue application, dependencies, build plugins, and tests        |
| `apps/web/src/api/`          | Generated backend contract types from OpenAPI                           |
| `apps/web/src/app/`          | Application shell, pages, layouts, router assembly, and locale messages |
| `apps/web/src/capabilities/` | Shared auth, HTTP, routing, state, localization, UI, and configuration  |
| `apps/web/src/modules/`      | Self-contained application modules, currently admin and sandbox         |
| `apps/web/src/components/`   | Shared Vue UI components                                                |

## Application Boundary

The reusable framework boundary is Oracle tooling and the CLI. Vue, Pinia, Vue
Router, Vue I18n, and Vuetify supply their own lifecycle and composition mechanisms;
the application composes them without a second capability runtime.

Within the web source, `api` holds the generated backend contract types,
`app` owns the application shell and built-in pages,
`capabilities` provides shared functionality consumed by app and modules,
`modules` describe application domains, and `components` provides shared UI.
Capabilities must not import app pages, layouts, or modules. Build-time
plugins stay outside browser source. The generated ORDS types are artifacts of
the database contract, not a hand-maintained API layer.

The Admin module exposes read-only user browsing at `/admin/users` and
`/admin/users/:id`, using `v-ov-table` and a static `v-ov-view` inside a single
Details tab. Both pages and the
`GET /admin/users` and `GET /admin/users/:id` services require the `admin` role.
Migration `00000000000003_admin` owns the blue/green `pck_admin` package.
Apply it through the normal `ov db migrate` workflow before using the module;
deployment refreshes the OpenAPI manifest consumed by the web application's
HTTP authentication policy. The list uses an exclusive user-ID cursor,
case-insensitive username/display-name search, and a limit of 1–101 rows
(26 by default). The UI displays five users per page on desktop and mobile,
requesting one extra row to detect the next page.
Only ID, username, display name, enabled state, and creation/update timestamps
are exposed; credentials and authentication secrets are never selected.
The non-editable details view passes raw service data to `v-ov-view`; date items
declare `format: { tsFormat: 'datetime' }`. The shared table/view renderer formats
timestamps for the current locale and browser time zone.
The default layout translates registered breadcrumb and navigation title keys
reactively, preserving literal titles and breadcrumb links.
Home-page cards also translate registered route-title and description keys.
User details append the full name (or username when absent) as the current
breadcrumb, keeping Users clickable. The name is cleared when leaving the page.

## Design

Design begins with the application domain: user needs, data model, and business
workflow. Model database objects with ODB, expose the required ORDS contract, then
build pages and components against generated types. Keep module-specific behavior
inside its module and extract shared behavior only when real reuse justifies it.
