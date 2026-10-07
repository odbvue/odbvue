# State Management

OdbVue applications use [Pinia](https://pinia.vuejs.org/) for shared application state. `src/app/state` exports the application Pinia instance, which `main.ts` installs explicitly. Application code defines domain stores.

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

The application persistence plugin supports `localStorage`, `sessionStorage`, `indexedDB`, and cookies. Register persistence once in `src/app/state`; do not install another Pinia instance in domain modules. The store registry is retained for sandbox diagnostics.
