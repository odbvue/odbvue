# Copilot Instructions for OdbVue

OdbVue is a full-stack template using Oracle Database (PL/SQL + ORDS) as backend and Vue 3 + Vuetify as frontend.

## Architecture

- `apps/` – Vue 3 + Vite frontend with VitePress docs (`apps/wiki/`)
- `db/` – Oracle PL/SQL packages, tables, ORDS REST APIs
- `cli/` – `ov` CLI for dev workflows, DB operations, feature branching
- `apps/src/modules/` – Feature modules (self-contained: pages, api, i18n)
- `apps/src/pages/` – Core app pages (admin, login, profile)

## Code Style

### TypeScript
- **Never** use `any` or disable linting rules. Always use strong typing.
- Remove unused variables instead of eslint-disable comments.

### Vue Components
- Use `<script setup lang="ts">` with `definePage()` for route meta.
- Use `VOv*` components: `VOvTable`, `VOvForm`, `VOvChart`, `VOvDialog` from `@/components`.
- Use composables: `useTableFetch()` for data grids, `useFormAction()` for CRUD actions, `useHttp()` for API calls.

Example page pattern (from `apps/src/pages/admin/`):
```vue
<script setup lang="ts">
definePage({
  meta: {
    title: 'Page Title',
    icon: '$mdiIcon',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})
const { loading, data, fetch } = useTableFetch<ResponseType>({
  endpoint: 'module/resource/',
  responseKey: 'items',
})
const { action } = useFormAction({
  endpoints: { save: 'module/resource/' },
  refetchOn: ['save'],
})
</script>
```

## Database (Oracle PL/SQL)

### Conventions
- Full conventions: `apps/wiki/guide/apis/conventions.md`
- Packages prefixed by domain: `pck_adm` (admin), `pck_crm` (CRM), `pck_api_*` (reusable APIs)
- Procedures prefixed `get_`, `post_`, `put_`, `delete_` auto-convert to ORDS REST endpoints
- Parameters: `p_` (input), `r_` (output/cursor), `v_` (local vars)
- Tables: primary key `id NUMBER(19)`, FK pattern `table_name_id`, constraint naming `pk_`, `fk_`, `idx_`

### Sample package structure
- Spec: `db/src/database/odbvue/package_specs/pck_adm.sql`
- Body: `db/src/database/odbvue/package_bodies/pck_adm.sql`

### TypeScript API Scaffolding (experimental)
Modules can define tables/packages in TypeScript (`apps/src/modules/*/api/`) using builders:
```typescript
import { Table, columnType as ct } from '@/apis/table'
import { Package, Procedure, ParamType as pt } from '@/apis/package'

export const myTable = new Table()
  .create('crm_persons', 'Description')
  .primaryKey('id')
  .col('id', ct.numberIdentity, 'Primary key')
  // ...

export const myPackage = new Package('pck_crm', 'CRM Package')
  .addProcedure(getProcedure)
```
Run `ov db-scaffold` to generate SQL from these definitions.

## CLI Commands (`ov`)

```sh
ov dev              # Start app + wiki dev servers
ov local-setup      # Initialize local Oracle DB container + config
ov db-install-local # Install/upgrade DB schema locally
ov db-scaffold      # Generate SQL from TypeScript API definitions
ov new-feature <n>  # Create feature branch feat/<n>
ov close-feature    # Squash-merge feature to main
ov commit-all <s> <m> # Conventional commit
```

## Module Structure

New feature modules go in `apps/src/modules/<name>/` with:
```
<module>/
  __tests__/    # e2e and API tests for module; unit tests for module specific components and composables
  api/          # TypeScript table/package definitions
    index.ts    # Exports schema, tables, packages
    tables/     # Table definitions
    packages/   # Package definitions
  components/   # Module-specific Vue components
  composables/  # Module-specific composables  
  pages/        # Vue pages (file-based routing)
  stores/       # Pinia stores (if module needs state management)
  i18n/         # Translations (en.json, de.json, fr.json)
  readme.md     # Feature spec with stories, data model, API design
```

## Testing

- Unit: `pnpm test:unit` (Vitest)
- E2E: `pnpm test:e2e` (Playwright)
- API: `pnpm test:api`

## Key Patterns

### API Calls
Use `useHttp()` composable which handles auth tokens, error handling, and performance logging automatically.

### Role-based Access
Pages define access in `definePage({ meta: { roles: ['admin'] } })`. Backend checks via `pck_api_auth.role()`.

### Forms with VOvTable
Actions in `VOvTable` can open forms. Define form config in table options, handle via `@action` event with `useFormAction()`.

## Steps for creating / amending new module 

1. Create new branch using `ov new-feature <module-name>`
2. Create / update feature spec in `readme.md`
3. Create module folder in `apps/src/modules/`
4. Add `api/`, `pages/`, `i18n/`, `stores/` subfolders as needed.
5. Define database tables and packages in `api/` using TypeScript builders.
6. Run `ov db-scaffold` to generate and apply SQL
7. Implement Vue pages in `pages/` using `VOv*` components and composables.
8. Create / update e2e and api test scenarios in `tests/e2e/`