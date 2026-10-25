# State Management

OdbVue applications use [Pinia](https://pinia.vuejs.org/) for shared application state. `src/capabilities/state` exports the application Pinia instance, which `main.ts` installs explicitly. Application code defines domain stores.

## Application capabilities and module state

`app` (or `useApp()`) from `@/capabilities` is the nested application runtime facade:

```ts
import { app } from '@/capabilities'

await app.auth.login(credentials)
app.auth.user.value
app.ui.loading.has('auth.login')
app.ui.loading.has('auth.profile')
app.ui.loading.active.value
```

The facade composes independent capabilities, not one giant Pinia store. Auth and
UI runtime state live in their own Pinia stores; HTTP is a stateless service.
`useAuth()` and `useUi()` remain focused entry points to the same state. Public
capability state is exposed as read-only refs; use actions to change it. Session
tokens, profiles, notifications, and loading activity are runtime-only and are
not persisted.

Application-wide capabilities belong under `app.<capability>`. Business modules
own their domain stores privately under `src/modules/<name>` and must not register
them on the application facade. Using Pinia does not make a module store an
application capability. Domain concurrency and cancellation belong to the owning
capability or module, not to the UI loading tracker.

```ts
export const useCustomerStore = defineStore('customers', () => {
  const selectedId = ref<string>()
  return { selectedId }
})
```

## Persistence

Add `persist` only when a store's state must survive a page reload.

```ts
export const useSettingsStore = defineStore(
  'settings',
  () => {
    const theme = ref('system')
    return { theme }
  },
  {
    persist: {
      storage: 'localStorage',
      paths: ['theme'],
    },
  },
)
```

The application persistence plugin supports `localStorage`, `sessionStorage`, `indexedDB`, and cookies. Register persistence once in `src/capabilities/state`; do not install another Pinia instance in domain modules. Use `createState()` from `src/capabilities/state` for isolated Pinia instances in tests; the application uses the shared `pinia` instance.

The sandbox State page displays active stores using Pinia's public reactive state, without a separate store registry.
