import { defineStore, acceptHMRUpdate } from 'pinia'
import { useSettingsStore } from './settings'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()

  return {
    settings: getSettings(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
