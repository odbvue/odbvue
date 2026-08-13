# TypeScript Toolkit

Beyond authoring SQL and PL/SQL, `@odbvue/odb` is a typed toolkit that turns a single Oracle model into queries, contracts, types, and a REST client. Highlights:

## Typed schema and query builder

Return an object from `odbTable()` to expose typed columns. The same definition infers selected rows, required inserts, nullable values, defaults, and updates.

```ts
import { odbQuery, odbTable } from '@odbvue/odb'
import type { Insertable, Selectable, Updateable } from '@odbvue/odb'

const users = odbTable('APP_USERS', (t) => ({
  id: t.number().identity().primaryKey(),
  uuid: t.guid().defaultSysGuid(),
  email: t.string(255),
  status: t.string(1).default('N').notNull(),
  createdAt: t.timestamp().defaultSysTimestamp().notNull(),
}))
  .unique((columns) => [columns.uuid])
  .check((columns, expression) => expression.in(columns.status, ['A', 'D', 'N']))

odbQuery().selectFrom(users).select([users.id]).where(users.id, '=', 123)
odbQuery().insertInto(users).values({ email: 'ada@example.com' })
odbQuery().updateTable(users).set({ email: null }).where(users.id, '=', 123)

type User = Selectable<typeof users>
type NewUser = Insertable<typeof users>
type UserUpdate = Updateable<typeof users>
```

Omitted names are inferred from object keys, so `createdAt` maps to `created_at`. Explicit names are supported for existing schemas. Table-level selectors provide autocomplete and reject unknown columns:

```ts
users.index((columns) => [columns.email, columns.createdAt]).unique((columns) => [columns.uuid])
```

Constraint and index names are generated from the table and selected columns. An explicit name can be supplied as the first argument when required. Column-level `.unique()` is also available for a single inline unique constraint.

Typed checks use the same column shape and validate values against the selected column type:

```ts
users.check((columns, expression) =>
  expression.and([
    expression.in(columns.status, ['A', 'D', 'N']),
    expression(columns.email, 'IS NOT NULL'),
  ]),
)
```

Table and column comments emit Oracle `COMMENT ON` statements:

```ts
const files = odbTable('app_files', (t) => ({
  id: t.number().identity().primaryKey().comment('Primary key'),
})).comment('Application files')
```

## Expression builder

`where()` also accepts an expression callback for `AND`/`OR`, functions, and subqueries, backed by a real AST + Oracle compiler (`compile()` returns SQL + binds).

```ts
.where((eb) => eb.or([eb(users.id, '=', 1), eb(users.email, 'IS NULL')]))
```

## Application contract

`odbPackage()` is the application model. Procedures retain their inputs, outputs, implementation, and service metadata in one serializable contract. PL/SQL, ORDS, TypeScript clients, and OpenAPI are generated from that model.

```ts
const settings = odbPackage('PCK_SETTINGS', (p) => ({
  getValue: p.func('GET_VALUE', 'VARCHAR2', (fn) => {
    fn.in('P_KEY', 'VARCHAR2')
  }),
}))

body.set(result, settings.getValue(odbLiteral('APP_VERSION')))
```

Use `generateApplication(pkg)` to emit its TypeScript contract, ORDS registration SQL, and OpenAPI document together. Generate HTTP clients from the OpenAPI document with your preferred OpenAPI tool.

## Introspection

`introspect.ts` emits data-dictionary queries and maps the returned rows into ODB tables, TypeScript row interfaces, and `odbTable(...)` scaffolds — useful for adopting an existing database. It stays driver-free (you supply the rows).

## Execution adapter

`@odbvue/odb-oracledb` runs compiled queries against Oracle with `OdbExecutor` (`execute`, `run`, `transaction`, `executeMany`). The core `@odbvue/odb` stays dependency-free; only the adapter depends on `oracledb`.

```ts
await withConnection(config, async (_conn, db) => {
  await db.execute(odbQuery().selectFrom(users).select([users.id]))
})
```

## OpenAPI contract

Use `p.proc()`, `proc.body()`, and `proc.service()` to define a service. A typed table query passed to `body.openFor()` carries its selected row shape into the generated response.

```ts
const result = proc.out('result', 'SYS_REFCURSOR')
proc.body((body) =>
  body.openFor(result, odbQuery().selectFrom(users).select([users.id, users.email])),
)
proc.service({ method: 'GET', path: '/users' })
```

The CLI writes `apps/db/dist/openapi.json` after every successful database migration operation. The document describes the API currently deployed to ORDS: `ov du` includes newly applied migrations, `ov dd` removes rolled-back migrations, and `ov di` writes an empty document after the schema is removed.

`SYS_REFCURSOR` outputs opened through a typed ODB query become reusable OpenAPI row schemas. The response preserves column types and nullability, so OpenAPI client generators can produce typed result arrays.

The web app consumes this manifest through `openapi-typescript`; see [Consuming Web Services](/guide/web/consuming-web-services#generated-ords-types).
