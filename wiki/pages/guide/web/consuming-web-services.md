# ORDS and Generated Web Clients

OdbVue applications consume Oracle APIs through a generated OpenAPI client.

```text
Oracle database -> ORDS -> OpenAPI manifest -> generated web client
```

ODB writes the deployed ORDS contract to `apps/db/dist/openapi.json`. The web build regenerates `apps/web/src/api/openapi.generated.ts` from that contract. Import its types in application API code; never edit the generated file manually.

```ts
import type { components, paths } from '@/api/openapi.generated'

type User = components['schemas']['UsersGetUserResultItem']
type GetUser = paths['/users/users/{id}']['get']
```

The application HTTP client supplies common behavior such as base URLs, request retries, authorization, and slow-request reporting. `useHttp()` from `@/capabilities/http` returns the installed application client; pass explicit options for an isolated test or sandbox client. Configure shared defaults under `http` in `odbvue.config.ts`.

Typed JSON responses are serialized by the backend, not decoded again by the
HTTP client. Typed cursor projections mark `json` columns with ORDS aliases such
as `meta AS "{}meta"`; generated JSON handlers embed those values with
`FORMAT JSON`. JSON-typed OUT fields also use native JSON serialization by
default for supported scalar responses. Objects, arrays, scalars, and nulls
arrive as JSON values, while ordinary string/CLOB columns remain strings.

## Errors and form submissions

Generated handlers return `application/problem+json` with `type`, `title`, HTTP
`status` and a stable `code`. A 422 validation response can also include
`errors: [{ field, code, params? }]`. The UI maps each code to the translation
key `errors.<CODE>` for the corresponding form field; `params` contains only
scalar values.
Malformed typed JSON objects are rejected with 400 before the procedure runs.
Unexpected failures return a generic code, not Oracle diagnostics. When an
service fails with a 5xx, `traceId` is a diagnostic reference; an audit record
may be unavailable if logging fails or the audit package is not installed.
Clients must not display server-provided titles or raw exceptions.

ODB procedures use the existing transport-independent exception helpers. For
example:

```ts
body.invalid('ORDER_INVALID', [
  { field: 'quantity', code: 'ORDER_MINIMUM_QUANTITY', params: { min: 1 } },
])
```

Field details are explicitly declared, not inferred from client rules.
The compact Oracle exception envelope is limited to 400 ASCII bytes after JSON
escaping; oversized or invalid details fail generation. Do not put submitted
values, secrets, or other sensitive information in error codes or parameters.
This initial transport supports static details and parameters, not dynamically
constructed or arbitrarily long error lists. Existing code-only exceptions
remain supported. Explicit HTTP errors and transport-independent errors share
the `ODB_ERROR` exception envelope. When upgrading an existing deployment,
redeploy `odb_http` and all generated ORDS handlers together; older handlers
and the new package (or vice versa) use incompatible exception envelopes and
error numbers (`ODB_HTTP` / `-20999` versus `ODB_ERROR` / `-20998`). Quiesce
requests during deployment so no request encounters a mixed version; Oracle DDL
and ORDS registration are not an atomic transaction.

The generated handler rolls back the current transaction when an exception
escapes. A procedure that commits or uses an autonomous transaction can still
persist work before failing; such operations must manage their own boundaries.
Authentication refresh remains the HTTP client's responsibility.

For mutations, use `ui.loading.run()` and call `complete(ui.mutationError(error))`
on failure. A recognized 422 maps `error.problem.errors` to form errors without
a snackbar. Other failures notify once and keep the form open. Define every field
code's `errors.<CODE>` key in the owning module's locales, and use names present in the form.
For business errors, add a translation under `errors.<CODE>`; otherwise a
generic notification is used. Missing translations and malformed details also
use a generic notification. Unknown form fields produce a form-level warning.
See Admin Settings for an example.

## Server-backed lists

```ts
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'

const http = useHttp()
const ui = useUi()
```

Bind only options and the fetch handler:

```vue
<v-ov-table :options="options" @fetch="fetchUsers" />
```

The table owns rows, local loading, normalized search, cancellation, and cursor
history. Its page shape is `{ items, nextCursor? }` (`OvTablePage`).
Forward the displayed limit and server cursor unchanged. Missing continuation means
the list is exhausted; clients do not request extra rows or construct cursor keys.

```ts
import type { OvTableFetchRequest } from '@/components'

async function fetchUsers({ cursor, limit, search, signal, complete }: OvTableFetchRequest) {
  const result = await ui.action('admin.users.list', async () => {
    const { data, error } = await http.get<components['schemas']['AdminListUsersResponse']>(
      '/admin/users',
      { query: { cursor, limit, search }, signal },
    )
    if (signal.aborted) return
    if (error || !data) throw new Error('admin.loadUsersError')
    if (!data.items.length) ui.info('admin.noUsers')
    return data
  })
  complete(result.ok ? result.data : undefined)
}
```

Always invoke the completion callback. `complete(page)` publishes the page and
commits cursor history; `complete(undefined)` finishes without changing the last
successful rows or continuation. The table rejects invalid pages with an error log.

The page owns named app loading and notifications through `ui.action()`.
Forward the provided signal and check it before notifying; supersession and unmount
abort the signal. The table settles cancelled navigation immediately and ignores late
or duplicate completions, even if a transport ignores abort. App loading remains
tracked until the HTTP action settles. The table does not import HTTP or UI
capabilities. HTTP errors still enter the normal error-capture pipeline.
