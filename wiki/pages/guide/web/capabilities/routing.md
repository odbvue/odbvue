# Routing

Application routing adapts generated Vue Router records into pages with a predictable title, route metadata, and navigation metadata. Shared APIs live in `apps/web/src/capabilities/routing`; application router assembly lives in `apps/web/src/app/router.ts`.

Use it when an application shell, navigation component, breadcrumb trail, or page-aware component needs to understand the current route or all available pages. Routes are generated from `src/app/pages` and `src/modules/<module>/pages`. The router registers the page manifest, authorization guard, and document-title handling directly.

## Router installation

```ts
import { createRouter, createWebHistory } from 'vue-router'
import { createAuthGuard, registerPageManifest, updatePageTitle } from '@/capabilities/routing'
import { manifest, routes } from 'virtual:odbvue-pages'

const router = createRouter({ history: createWebHistory(), routes })
registerPageManifest(router, manifest)
router.beforeEach(createAuthGuard(router))
router.afterEach((to, _from, failure) => {
  if (!failure) updatePageTitle(to.meta)
})
export default router
```

Install this router with `app.use(router)` in `main.ts`. The guard awaits lazy, idempotent auth restoration before evaluating every matched route, including parents. The application shell mounts immediately while navigation is pending. Successful navigation updates `document.title` directly; failed or cancelled navigation leaves it unchanged.

Configure application destinations with `auth.routes`: `login` defaults to `/login`, while `authenticated` and `forbidden` default to `/`. An anonymous user requesting an authenticated, role-protected, or permission-protected page is redirected to login with the original URL in `query.redirect`. Other denied requests show `auth.forbidden` and return to the forbidden destination.

## How it works

The routing capability keeps metadata validation and adaptation in `metadata.ts`, access decisions and guards in `auth.ts`, and reactive routing, breadcrumbs, and parameter composables in `navigation.ts`. `manifest.ts` builds the page manifest, `registry.ts` stores per-router state, `types.ts` defines shared contracts, and `index.ts` exposes the public API.

`useRouting()` reads the active Vue Router instance and returns computed values:

| Value           | Description                                                 |
| --------------- | ----------------------------------------------------------- |
| `pages`         | Navigable, ordered root-level pages.                        |
| `allPages`      | Every registered route, adapted to an OdbVue page.          |
| `currentPage`   | The deepest route record matched by the current URL.        |
| `currentModule` | The module declared by the current page metadata.           |
| `breadcrumbs`   | Visible pages along the current URL hierarchy.              |
| `title`         | A function that resolves a registered page title by path.   |
| `params`        | Normalized path and query parameters for the current route. |
| `navigate`      | Vue Router's programmatic navigation function.              |

Each page exposes its route path, the original normalized Vue Router record, `meta`, a derived `title`, and a resolved `navigation` boolean. A title comes from `meta.title` when present; otherwise it is derived from the final path segment, so `/customer-orders` becomes `Customer Orders`.

```ts
import { useRouting } from '@/capabilities/routing'

const { allPages, breadcrumbs, currentModule, currentPage, navigate, pages, params, title } =
  useRouting()
```

The returned values are Vue computed refs. Read their values in script with `.value`; Vue automatically unwraps them in templates.

## Page metadata

Declare metadata with `definePage()` in a page component. Every Vue or Markdown page must explicitly declare `access` and a boolean `navigation`; the completed route manifest validates these after page metadata is merged. Generated structural parent routes without a page component are exempt. Application routing reads this metadata from Vue Router and applies it consistently to guards and navigation.

```vue
<script setup lang="ts">
definePage({
  meta: {
    title: 'Customers',
    description: 'Search and maintain customers.',
    icon: '$mdiAccountGroup',
    order: 20,
    layout: 'default',
    access: ['sales'],
    navigation: true,
  },
})
</script>
```

`canAccessPage(meta, auth)` interprets `access` consistently for guards and navigation:

- `public`: accessible to anyone.
- `authenticated`: require an authenticated identity.
- `anonymous`: require an anonymous session.
- A non-empty role array, such as `['admin', 'editor']`: require authentication and **any** listed role. Empty arrays and blank role names are invalid.

The access type is:

```ts
type PageAccess = 'public' | 'authenticated' | 'anonymous' | [string, ...string[]]
```

`canShowPage(meta, auth)` additionally checks `navigation !== false`. Disabling navigation hides a page from menus and breadcrumbs without denying route access. There is no separate `roles`, `visibility`, or page-level `hidden` policy. Server endpoints must enforce their own authorization.

Optional `permissions` add an **all-permissions** requirement to authenticated or role-protected access:

```ts
definePage({
  meta: {
    access: 'authenticated',
    permissions: ['settings.read'],
    navigation: true,
  },
})
```

Use `access: 'authenticated'` when a page needs a session without role or permission requirements. Login uses anonymous access and opts out of navigation:

```ts
definePage({
  meta: {
    access: 'anonymous',
    navigation: false,
  },
})
```

When a role array and permissions are both present, access requires any listed role **and** every listed permission. Non-empty permissions with `public` or `anonymous` access are invalid rather than silently changing the session requirement.

Login pages can use `resolveAuthRedirect(router, route.query.redirect, fallback, login)` after `useAuth().login()`. It preserves local query strings and fragments while rejecting external URLs, protocol-relative URLs, backslashes, control characters, unmatched paths, and the login page itself. Optional fallback and login destinations default to `/` and `/login`.

## Practical examples

### Build a navigation list

`routing.pages` is already filtered and ordered for application navigation. Navigation and breadcrumbs react to authentication changes and enforce route access, including parent access requirements. `allPages` remains the unfiltered registry. A page's `navigation` boolean reflects its explicit declaration. Display metadata comes from page `title`, `icon`, and `order`.

```vue
<script setup lang="ts">
import { useRouting } from '@/capabilities/routing'

const { pages } = useRouting()
</script>

<template>
  <v-list nav>
    <v-list-item
      v-for="page in pages.value"
      :key="page.path"
      :to="page.path"
      :prepend-icon="page.meta.icon || '$mdiMinus'"
      :title="page.title"
    />
  </v-list>
</template>
```

Set navigation display and ordering with top-level page metadata:

```ts
definePage({
  meta: {
    title: 'Customer administration',
    access: ['admin'],
    icon: '$mdiAccountGroup',
    order: 20,
    navigation: true,
  },
})
```

### Render breadcrumbs

Breadcrumbs are built from each URL prefix that has a registered, visible page. For `/customers/42`, create pages for `/`, `/customers`, and `/customers/:id` to render a complete trail.

```vue
<script setup lang="ts">
import { useRouting } from '@/capabilities/routing'

const { breadcrumbs } = useRouting()
</script>

<template>
  <v-breadcrumbs :items="breadcrumbs" />
</template>
```

### Adapt the current page

Use `usePageMeta()` when a component only needs metadata from the current page. This is useful for page headers and layout-level UI.

```vue
<script setup lang="ts">
import { usePageMeta } from '@/capabilities/routing'

const pageMeta = usePageMeta()
</script>

<template>
  <v-toolbar-title>{{ pageMeta.title || 'OdbVue' }}</v-toolbar-title>
</template>
```

### Detect the active module

`currentModule` is declared in page metadata and is `undefined` when the current page has no `module`. A layout can use it to select module-specific UI without parsing paths.

```ts
import { computed } from 'vue'
import { useRouting } from '@/capabilities/routing'

const { currentModule } = useRouting()
const isCustomersModule = computed(() => currentModule.value === 'customers')
```

## Related documentation

- [Routing and pages](/guide/web/file-based-routing) covers creating file-based routes and declaring page metadata.
- [Web configuration](/guide/web/web-configuration) covers the application configuration boundary.
