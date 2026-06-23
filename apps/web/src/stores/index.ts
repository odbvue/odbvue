import { defineStore, acceptHMRUpdate } from 'pinia'
import { useSettingsStore } from './settings'
import { useNavigationStore } from './navigation'
import { version as packageVersion, title as packageTitle } from '../../../../package.json'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()
  const getNavigation = () => useNavigationStore()

  return {
    version: packageVersion,
    title: packageTitle,
    settings: getSettings(),
    navigation: getNavigation(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
