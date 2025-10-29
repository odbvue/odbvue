import { defineStore, acceptHMRUpdate } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()
  const getNavigation = () => useNavigationStore()

  return { settings: getSettings(), navigation: getNavigation() }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
  import.meta.hot.accept(acceptHMRUpdate(useNavigationStore, import.meta.hot))
}
