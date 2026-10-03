# ORDS and Generated Web Clients

OdbVue applications consume Oracle APIs through a generated OpenAPI client.

```text
Oracle database -> ORDS -> OpenAPI manifest -> generated web client
```

ODB writes the deployed ORDS contract to `apps/db/dist/openapi.json`. The web build regenerates `apps/web/src/services/openapi.generated.ts` from that contract. Import its types in application API code; never edit the generated file manually.

```ts
import type { components, paths } from '@/services/openapi.generated'

type User = components['schemas']['UsersGetUserResultItem']
type GetUser = paths['/users/users/{id}']['get']
```

The application HTTP client supplies common behavior such as base URLs, request retries, authorization, and slow-request reporting. Use it from application code; configuring its framework bootstrap is not part of the normal application workflow.
