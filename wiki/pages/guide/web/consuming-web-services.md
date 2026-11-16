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

For PL/SQL services whose response fields are all `odbType.json()`, declare
`responseMediaType: 'application/json'` to return native JSON values. The generated
handler validates the JSON and streams it without ORDS quoting the fields.
Other JSON-typed OUT fields retain ORDS's JSON-string transport; the HTTP client
decodes these using OpenAPI's `x-odb-type: json` metadata and leaves native values
unchanged.

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
