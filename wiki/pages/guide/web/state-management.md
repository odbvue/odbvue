# State Management

OdbVue applications use [Pinia](https://pinia.vuejs.org/) for shared application state. Pinia is installed as part of the web runtime; application code defines only domain stores.

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

The application persistence runtime supports `localStorage`, `sessionStorage`, `indexedDB`, and cookies. Do not add Pinia bootstrap code to `main.ts`.
