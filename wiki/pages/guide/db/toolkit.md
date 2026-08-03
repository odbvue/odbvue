# TypeScript Toolkit

Beyond authoring SQL and PL/SQL, `@odbvue/odb` is a typed toolkit that turns a single Oracle model into queries, contracts, types, and a REST client. Highlights:

## Typed schema and query builder

Tables and columns are strongly typed, so queries reject invalid columns and mismatched values at compile time.

```ts
const users = odbTable('APP_USERS', (t) => ({
  id: t.number('id').notNull(),
  email: t.string('email', 255),
}))

odbQuery().selectFrom(users).select([users.id]).where(users.id, '=', 123)
```

## Expression builder

`where()` also accepts an expression callback for `AND`/`OR`, functions, and subqueries, backed by a real AST + Oracle compiler (`compile()` returns SQL + binds).

```ts
.where((eb) => eb.or([eb(users.id, '=', 1), eb(users.email, 'IS NULL')]))
```

## PL/SQL package contracts

`generatePackageContract(pkg)` turns a package's procedures/functions into a TypeScript interface (inputs from `IN`/`IN OUT`, results from `OUT`/`IN OUT`).

## Introspection

`introspect.ts` emits data-dictionary queries and maps the returned rows into ODB tables, TypeScript row interfaces, and `odbTable(...)` scaffolds — useful for adopting an existing database. It stays driver-free (you supply the rows).

## Execution adapter

`@odbvue/odb-oracledb` runs compiled queries against Oracle with `OdbExecutor` (`execute`, `run`, `transaction`, `executeMany`). The core `@odbvue/odb` stays dependency-free; only the adapter depends on `oracledb`.

```ts
await withConnection(config, async (_conn, db) => {
  await db.execute(odbQuery().selectFrom(users).select([users.id]))
})
```

## Typed ORDS client

Procedures exposed via `proc.service({ method, path })` become a typed client. Run `ov dt` to generate `apps/web/src/services/ords.generated.ts` from the migrations (no database needed):

```ts
export interface OrdsOperations {
  appMe: { request: AppMeRequest; response: AppMeResponse }
}

export const ordsOperations = {
  appMe: { method: 'GET', path: 'app/auth/me' },
} as const satisfies Record<keyof OrdsOperations, OrdsOperationDescriptor>
```

Consume it from the web `http` composable:

```ts
const op = ordsOperations.appMe
const { data } = await http.get<OrdsOperations['appMe']['response']>(op.path)
```
