# Oracle Database in TypeScript

OdbVue uses a TypeScript-first database model that is conceptually similar to Kysely: you describe database objects and SQL operations with fluent builders in TypeScript, and those builders compile to Oracle SQL.

In OdbVue TypeScript does not only describe queries. It also describes:

- schema creation
- table DDL
- PL/SQL packages and procedures
- ORDS REST endpoints
- edition-based deployment steps
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

- `packages/odb`: fluent builders for Oracle concepts such as tables, packages, ORDS endpoints, editions, and queries.
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
  version: '1.0.1',
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
- `ALTER USER ... ENABLE EDITIONS`

This is infrastructure DDL, not application DML.

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

`defineMigration()` is the unit of deployment. You declare what a release contains with `install()` and `expose()`; the framework derives the reverse `down` direction and the Oracle edition ceremony from the schema and semantic version.

```ts
import { defineMigration, odbTable } from '@odbvue/odb'

const users = odbTable('app_users', (t) => {
  t.guid('id').defaultSysGuid().primaryKey().notNull()
  t.string('email', 320).notNull()
})

export const migration = defineMigration('20260704120000_app_users', {
  schema: 'APP_USER',
  version: '1.0.2',
}).install(users)
```

This migration derives, creates, and selects edition `APP_USER_1_0_2`, installs the artifacts, and makes the edition the default. The `down` direction is generated as the mirror image: it restores the previous migration's edition as the default, drops the artifacts in reverse order, and drops the new edition. Set `edition: 'none'` for non-editioned migrations. Schema-creating bootstrap migrations need no special handling — the framework grants the edition to the schema after the user is created.

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

### Editions

Schema-aware migrations derive and manage editions automatically. `odbEdition` remains available for bootstrap and release-level operations such as changing the database default edition by hand.

```ts
import { odbEdition } from '@odbvue/odb'

const edition = new odbEdition('1.0.0', 'APP_USER')

edition.ensureCreated()
edition.grantUse()
edition.setDefault()
```

This allows advanced release flows to prepare edition-aware releases explicitly, but everyday migrations never need it — declaring `install()` / `expose()` is enough.

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
- Use `.service()` and `odbOrdsSchema()` when package procedures should become REST endpoints.
- Use `defineMigration()` to version all of the above.
- Use `odbEdition` when the release strategy needs Oracle editions.

Together, these pieces form a TypeScript-authored, Oracle-native delivery workflow.
