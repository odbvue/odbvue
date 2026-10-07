# State Management

OdbVue applications use [Pinia](https://pinia.vuejs.org/) for shared application state. `src/capabilities/state` exports the application Pinia instance, which `main.ts` installs explicitly. Application code defines domain stores.

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
