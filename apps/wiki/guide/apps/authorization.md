# Authorization

## Concepts

### Role-Based Authorization

A security mechanism that restricts access to resources or functionality based on a user's role within an application. It ensures users can only perform actions or view content permitted for their assigned roles.

### Navigation Guards

A feature in front-end frameworks that controls access to routes or pages based on conditions such as authentication, user roles, or application state, ensuring users navigate only to authorized or appropriate areas.

### Page Meta

Metadata associated with a web page, such as titles, descriptions, and keywords, used to improve SEO, accessibility, and user experience. Page meta's are often set dynamically based on the content or purpose of the page.

## Data model

![Authorization - Data  Model](./authorization-data-model.png)

## API

Extend existing `get_context` routine to return privilege data.

#### `./db/src/database/odbvue/package_bodies/pck_app.sql`

```plsql{7-24}
-- ...
  OPEN r_user FOR SELECT
      uuid           AS "uuid",
      username       AS "username",
      fullname       AS "fullname",
      created        AS "created",
      coalesce((
          SELECT
              JSON_ARRAYAGG(
                  JSON_OBJECT(
                      'role' VALUE r.role,
                      'permission' VALUE p.permission,
                      'validfrom' VALUE p.valid_from,
                      'validto' VALUE p.valid_to
                  )
              )
          FROM
                    app_permissions p
              JOIN app_roles r ON r.id = p.id_role
              JOIN app_users u ON u.id = p.id_user
          WHERE
              u.uuid = v_uuid
      ),
                '[]') AS "{}privileges"
  FROM
      app_users
  WHERE
  uuid = v_uuid
  AND v_uuid IS NOT NULL;
-- ...
```

## Store

User data type with privileges in Application Main store.

#### `@/stores/index.ts`

```ts
    // ..
    type ContextResponse = {
      version: string
      user?: {
        uuid: string
        username: string
        fullname: string
        created: string
        privileges: {
          role: string
          permission: string
          validfrom: string
          validto: string
        }[]
      }[]
      consents: {
        id: string
        language: string
        name: string
        created: string
      }[]
    }
    // ..    

    const defaultUser = {
      uuid: '',
      username: '',
      fullname: '',
      created: '',
      privileges: [] as {
        role: string
        permission: string
        validfrom: string
        validto: string
      }[],
    }
    // ..
```

## Pages & Page Meta's

### Visibility & Access Props

Meta properties control page visibility and access permissions:

#### Visibility

Determines whether a page link/item appears in navigation menus and UI:

| Value | Description |
|-------|-------------|
| `always` | Page always appears in navigation, regardless of authentication state |
| `when-authenticated` | Page only appears when user is logged in |
| `when-unauthenticated` | Page only appears when user is not logged in |
| `with-role` | Page only appears when user has one of the specified roles |
| `never` | Page never appears in navigation (e.g., error pages, authentication pages) |

#### Access

Controls whether a user can actually access the page:

| Value | Description |
|-------|-------------|
| `always` | Page is always accessible to anyone |
| `when-authenticated` | Page requires user to be logged in |
| `when-unauthenticated` | Page only accessible to users not logged in |
| `with-role` | Page requires user to have one of the specified roles |
| `never` | Page is never accessible |

#### Page Meta Definition

Page meta can be set using `definePage()` in `.vue` files:

```ts
<script setup lang="ts">
definePage({
  meta: {
    title: 'Page Title',
    description: 'Page description',
    icon: '$mdiIcon',
    color: '#HEXCOLOR',
    visibility: 'always',
    access: 'when-authenticated',
    roles: ['admin', 'editor']  // required for 'with-role'
  }
})
</script>
```

Or in `.vue` files using `<route>` block:

```vue
<route lang="json">
{
  "meta": {
    "title": "Admin",
    "visibility": "with-role",
    "access": "with-role",
    "roles": ["admin"]
  }
}
</route>
```

Or in `.md` files using frontmatter:

```md
---
title: About
description: Learn more about our platform
icon: $mdiInformation
color: '#FA8531'
visibility: always
access: always
---

# About

Page content here...
```

### Apply meta to pages

| Page | Path | Visibility | Access | Roles |
|------|------|------------|--------|-------|
| Welcome Home | `/` | `always` | `always` | - |
| About | `/about` | `always` | `always` | - |
| Login | `/login` | `never` | `when-unauthenticated` | - |
| Sign Up | `/signup` | `never` | `when-unauthenticated` | - |
| Recover Password | `/recover-password` | `never` | `when-unauthenticated` | - |
| Reset Password | `/reset-password/[token]` | `never` | `always` | - |
| Confirm Email | `/confirm-email/[id]` | `never` | `always` | - |
| Sandbox | `/sandbox` | `always` | `when-authenticated` | - |
| Admin | `/admin` | `with-role` | `with-role` | `admin` |
| Not Found | `/[...path]` | `never` | `always` | - |

## Navigation guards

Guard method in Navigation Store

#### `@/stores/app/navigation.ts`

::: details source
<<< ../../../src/stores/app/navigation.ts
:::

Guard in Router 

#### `@/router/index.ts`

```ts
// ...
router.beforeEach(async (to) => {
  const app = useAppStore()
  app.ui.clearMessages()
  const result: string | boolean = app.navigation.guard(to.path)
  if (result) {
    const appTitle = title || 'OdbVue'
    const pageTitle = app.navigation.title(to.path)
    const documentTitle = pageTitle ? `${appTitle} - ${pageTitle}` : appTitle
    useHead({ title: documentTitle })
  } else {
    window.scrollTo(0, 0)
    app.ui.setError('unauthorized')
  }
  return result === '/login' ? { path: result, query: { redirect: to.path } } : result
})
// ...
```

> [!WARNING]
> Client side navigation guard does not prevent from authorization flaws, always apply navigation guards in back-end using `pck_api_auth.role` and `pck_api_auth.perm`!
