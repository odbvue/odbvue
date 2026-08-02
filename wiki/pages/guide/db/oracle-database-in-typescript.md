# Oracle Database in TypeScript

OdbVue uses a TypeScript-first database model that is conceptually similar to Kysely: you describe database objects and SQL operations with fluent builders in TypeScript, and those builders compile to Oracle SQL.

In OdbVue TypeScript does not only describe queries. It also describes:

- schema creation
- table DDL
- PL/SQL packages and procedures
- ORDS REST endpoints
- blue/green package deployment
- migration scripts

This makes TypeScript the authoring language, while Oracle SQL and PL/SQL remain the runtime language.

## Overview

At a high level, the flow is:

1. Define Oracle objects in TypeScript with `@odbvue/odb`.
2. Export those definitions from migration files in `apps/db/src/migrations`.
3. Let the CLI compile migrations into `.sql` files.
4. Execute the generated SQL against Oracle and record applied migrations in `app_migrations`.

In practice, the system is closer to a typed SQL and PL/SQL code generator than to a classic ORM.

## How It Works

The main pieces are:

- `packages/odb`: fluent builders for Oracle concepts such as tables, packages, ORDS endpoints, and queries.
- `apps/db`: migration source files that assemble those builders into deployable database changes.
- `cli db-*` commands: compile and execute the generated SQL.

Example migration shape:

```ts
import { defineMigration, odbPackage } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

const appPackage = odbPackage('pck_app', (p) => {
  p.procedure('version', (proc) => {
    const version = proc.out('version', 'VARCHAR2')

    proc.body((body) => {
      const vVersion = body.varchar2('v_version', 200).value('1.0.1')
      body.set(version, vVersion)
    })

    proc.service({
      method: 'GET',
      path: '/version',
      summary: 'Returns the application version',
    })
  })
})

export const migration = defineMigration('20260628161706_test', {
  schema: schemaName,
})
  .install(appPackage)
  .expose(appPackage)
```

That single migration can emit package DDL, ORDS registration PL/SQL, and the matching rollback SQL, which the framework derives automatically.

## Core Concepts

### DDL: Schemas and Users

`odbSchema()` describes an Oracle schema user and emits the SQL needed to create it.

```ts
import { odbSchema } from '@odbvue/odb'

const appSchema = odbSchema('APP_USER', 'secret', (schema) => {
  schema.grant('EXECUTE ON DBMS_CRYPTO')
})

const sql = appSchema.toSQLUp()
```

This compiles to statements such as:

- `CREATE USER ...`
- `GRANT CREATE SESSION ...`

This is infrastructure DDL, not application DML. Everything stays in the default `ORA$BASE` edition — OdbVue does not use Oracle editions.

### DDL: Tables and Indexes

`odbTable()` describes a table, its columns, and indexes.

```ts
import { odbTable } from '@odbvue/odb'

const appMigrationsTable = odbTable('app_migrations', (t) => {
  t.timestamp('created').defaultCurrentTimestamp().notNull()
  t.string('name', 200).notNull()
  t.unique('uq_app_migrations_name', ['name'])
})

const sql = appMigrationsTable.toSQLUp({ schema: 'APP_USER' })
```

This produces Oracle DDL such as `CREATE TABLE`, primary-key constraints, and `CREATE INDEX` or `CREATE UNIQUE INDEX` statements.

### DDL: Incremental Table Changes

For smaller follow-up changes, `alterTable()` emits `ALTER TABLE` statements.

```ts
import { alterTable } from '@odbvue/odb'

const sql = alterTable('app_users', 'APP_USER')
  .addColumn('display_name', 'string', { length: 200, nullable: false })
  .compile()
```

This is useful for additive migrations where a full `CREATE TABLE` is no longer appropriate.

### Migrations

`defineMigration()` is the unit of deployment. You declare what a release contains with `install()` and `expose()`; the framework derives the reverse `down` direction automatically.

```ts
import { defineMigration, odbTable } from '@odbvue/odb'

const users = odbTable('app_users', (t) => {
  t.guid('id').defaultSysGuid().primaryKey().notNull()
  t.string('email', 320).notNull()
})

export const migration = defineMigration('20260704120000_app_users', {
  schema: 'APP_USER',
}).install(users)
```

The `down` direction is generated as the mirror image: it drops the artifacts in reverse order. Tables and other plain DDL are installed and rolled back directly. Packages use blue/green deployment (see below), so a redeploy never blocks live callers and rolls back to the previous version instantly.

- `install(artifact)` — schemas, tables, packages, or pre-built APIs (anything with `toSQLUp` / `toSQLDown`).
- `expose(artifact)` — publishes ORDS endpoints (anything with `toOrdsSQL` / `toOrdsDownSQL`).
- `upRaw(sql)` / `downRaw(sql)` — escape hatches for custom or irreversible SQL.

Artifacts run in the exact order you declare them in `up`, and in reverse for `down`, so dependencies install and roll back safely without hidden reordering.

In this repository, migrations live in `apps/db/src/migrations`. The CLI compiles them from JavaScript modules in `apps/db/dist/migrations` and writes generated SQL into `apps/db/dist/sql`.

### DML: Queries

`odbQuery()` is the Kysely-like part most people expect first. It builds `SELECT`, `INSERT`, `UPDATE`, and `DELETE` statements.

```ts
import { odbQuery } from '@odbvue/odb'

const query = odbQuery()

const selectSql = query
  .selectFrom('app_users')
  .select(['id', 'email'])
  .where('email', '=', 'a@example.com')
  .orderBy('email')
  .limit(1)
  .toSQL()
```

You can also compile bind variables instead of inline literals:

```ts
const compiled = query
  .insertInto('app_users')
  .values({ id: '...', email: 'a@example.com' })
  .compile()

compiled.sql
compiled.bindings
```

This is DML and read-query generation, not schema generation.

### PL/SQL Packages and Procedures

`odbPackage()` models Oracle package specs and bodies in TypeScript.

```ts
import { odbPackage } from '@odbvue/odb'

const appPackage = odbPackage('pck_app', (pkg) => {
  pkg.procedure('version', (proc) => {
    const version = proc.out('version', 'VARCHAR2')

    proc.body((body) => {
      const vVersion = body.varchar2('v_version', 200).value('1.0.1')
      body.set(version, vVersion)
    })
  })
})

const sql = appPackage.toSQLUp({ schema: 'APP_USER' })
```

This emits both:

- `CREATE OR REPLACE PACKAGE ...`
- `CREATE OR REPLACE PACKAGE BODY ...`

This is the main way to keep database business logic close to the data while still authoring it in TypeScript.

### Oracle Built-in Packages

Oracle ships many built-in packages (`UTL_RAW`, `UTL_ENCODE`, `DBMS_LOB`, `DBMS_CRYPTO`, and so on). OdbVue provides typed TypeScript wrappers for the most common ones so you can compose calls inside a package body without hand-writing PL/SQL call strings. These packages already exist in every database, so there is no install step.

```ts
import { odbDbmsCrypto, odbPackage } from '@odbvue/odb'

const secure = odbPackage('pck_secure', (pkg) => {
  pkg.func('sha256', 'RAW', (fn) => {
    const pData = fn.in('p_data', 'RAW')
    fn.body((body) => {
      body.return(odbDbmsCrypto.hash(pData, odbDbmsCrypto.HASH_SH256))
    })
  })
})
```

Each wrapper returns a typed expression whose PL/SQL return type flows into `body.set()`, so type mismatches are caught at compile time. Algorithm constants (`odbDbmsCrypto.HASH_SH256`) and helpers (`odbDbmsCrypto.cipherSuite(...)`) are provided too. `DBMS_LOB` and `DBMS_CRYPTO` procedures — the ones with `OUT` parameters — return the call string for use with `body.raw(...)` instead of an expression.

Available wrappers:

- `odbUtlRaw` — RAW manipulation, bitwise operations, and casts (`UTL_RAW`)
- `odbUtlEncode` — Base64, quoted-printable, and uuencode (`UTL_ENCODE`)
- `odbDbmsLob` — LOB length/substr/compare functions and read/write procedures (`DBMS_LOB`)
- `odbDbmsCrypto` — hashing, MAC, encrypt/decrypt, sign/verify, and random generators (`DBMS_CRYPTO`)

### Framework Packages

OdbVue also ships a small set of reusable PL/SQL packages of its own — _framework packages_ — whose SQL source lives inside `@odbvue/odb`. Unlike the built-in wrappers, these must be created in your schema, so you `install()` them in a migration. They follow the `odb_*` naming convention; for example the LOB/Base64 helper is the `odb_lob` package, exposed in TypeScript as `odbLob`.

```ts
import { defineMigration, odbLob } from '@odbvue/odb'

export const migration = defineMigration('20260704120000_lob', {
  schema: 'APP_USER',
}).install(odbLob)
```

Once installed, call them from your own package bodies (`odbLob.varchar2ToBase64('v_text')`) or through the typed variable helpers (`ClobVar.toBase64()`). See the LOB capability page for details.

Other framework packages follow the same pattern — for example `odb_jwt` (`odbJwt`) signs and verifies JSON Web Tokens with HS256, and `odb_audit` (`odbAudit`) writes OpenTelemetry-aligned audit logs. See the JWT and Audit capability pages for details.

### ORDS: REST Endpoints From PL/SQL

ORDS support is built into the same model.

Define the public HTTP contract with `.service()`. Then `toOrdsSQL()` emits the ORDS registration PL/SQL needed to expose the procedure as a REST endpoint.

```ts
import { odbPackage } from '@odbvue/odb'

const usersApi = odbPackage('pck_users', (pkg) => {
  pkg.procedure('get_user', (proc) => {
    proc.in('p_user_id', 'NUMBER')
    proc.out('r_user', 'SYS_REFCURSOR')
    proc.body((body) => {
      body.raw('OPEN r_user FOR SELECT id, email FROM app_users WHERE id = p_user_id')
    })
    proc.service({
      method: 'GET',
      path: '/users/:user-id',
      summary: 'Fetch a single user',
      paramTypes: {
        p_user_id: 'INT',
      },
    })
  })
})

const sql = usersApi.toOrdsSQL({ schema: 'APP_USER' })
```

The service contract makes the HTTP method and route visible during code review. The builder still derives infrastructure details:

- package name becomes the ORDS module name
- PL/SQL parameters map to ORDS parameters

Use `.ords()` only when convention-derived methods and paths are preferred over an explicit public contract.

The migration context enables schema-level ORDS automatically before the first `expose()` operation. It can still be managed explicitly outside the context:

```ts
import { odbOrdsSchema } from '@odbvue/odb'

const sql = odbOrdsSchema('APP_USER').toSQLUp()
```

### Blue/Green Package Deployment

Packages are deployed with a blue/green strategy so live callers (ORDS handlers, jobs, other packages) are never blocked by a recompile, and a release can be rolled back instantly. This is handled automatically — `install()` a package and the framework does the rest. Everything stays in `ORA$BASE`; no Oracle editions are used.

How it works:

- Each package is created under a colored physical name, e.g. `PCK_APP_BLUE` / `PCK_APP_GREEN`.
- A stable synonym (`PCK_APP`) points at the active color. All callers reference the synonym, so they resolve to whichever color is live.
- On each redeploy the framework compiles the **idle** color (the copy nobody is using), then repoints the synonym. Because the recompiled copy is never in use, there is no library-cache lock contention (`ORA-04021`).
- The active color per object is tracked in the `app_migrations_objects` registry table.
- `down` reverts by swapping the synonym back to the previous color, which is still present — an instant rollback with no recompile. The first install's `down` drops the package and synonym outright.

Colors alternate deterministically per object across the ordered migration set, so the generated SQL is plain, reviewable DDL.

## CLI Workflow

The `cli` package is what turns these TypeScript definitions into deployed database changes.

### `ov db-scaffold`

Creates a new migration file in `apps/db/src/migrations` with a timestamp-based name and a ready-to-fill `defineMigration()` template.

```bash
ov db-scaffold add-users-package
```

### `ov db-up`

Runs the migration pipeline in the `up` direction.

What it does:

1. Loads secrets such as `ODBVUE_ADB_SCHEMA_USERNAME`.
2. Compiles migration modules into SQL files.
3. Reads applied migration names from `<schema>.app_migrations`.
4. Executes only pending `_up.sql` files.
5. Inserts each successful migration name into `app_migrations`.

### `ov db-down`

Runs the same migration pipeline in reverse order using `_down.sql` files and removes applied migration records after successful rollback.

### `ov db-exec`

Executes a single SQL statement or a SQL file.

```bash
ov db-exec "SELECT * FROM app_user.app_migrations"
ov db-exec apps/db/dist/sql/20260628161706_test_up.sql
```

The executor is Oracle-aware:

- plain SQL DDL and DML are split on semicolons
- PL/SQL blocks are kept intact and detected by `BEGIN` or `CREATE OR REPLACE ...`
- SQL\*Plus style `/` block terminators are supported
- `DBMS_OUTPUT` is enabled and printed when available

That matters because generated package and ORDS scripts are PL/SQL-heavy, while table migrations are usually plain DDL.

## Mental Model

The most useful way to think about this stack is:

- `packages/odb` is the authoring DSL
- `apps/db` is the deployment source tree
- Oracle SQL and PL/SQL are the compiled output
- the CLI is the execution engine

So "Oracle Database in TypeScript" here does not mean Oracle is replaced by TypeScript. It means TypeScript is used to define, version, and generate Oracle-native artifacts in a structured way.

## When To Use Which Concept

- Use `odbSchema()` for schema-user provisioning.
- Use `odbTable()` and `alterTable()` for DDL.
- Use `odbQuery()` for DML and read queries.
- Use `odbPackage()` for business logic that belongs in PL/SQL.
- Use the built-in wrappers (`odbUtlRaw`, `odbUtlEncode`, `odbDbmsLob`, `odbDbmsCrypto`) to call Oracle's own packages from a package body.
- Use framework packages such as `odbLob` for odb-provided helpers that install into your schema under the `odb_*` naming convention.
- Use `.service()` and `odbOrdsSchema()` when package procedures should become REST endpoints.
- Use `defineMigration()` to version all of the above.
- Packages deploy blue/green automatically for lock-free redeploys and instant rollback.

Together, these pieces form a TypeScript-authored, Oracle-native delivery workflow.
