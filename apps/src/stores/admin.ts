import { defineStore, acceptHMRUpdate } from 'pinia'

export const useAdminStore = defineStore(
  'admin',
  () => {
    const tab = ref('details')

    return {
      tab,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['tab'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAdminStore, import.meta.hot))
}
