import { defineStore, acceptHMRUpdate } from 'pinia'
import { useSettingsStore } from './settings'
import { useNavigationStore } from './navigation'
import { useUiStore } from './ui'
import { version as packageVersion, title as packageTitle } from '../../../../package.json'

export const useAppStore = defineStore('app', () => {
  const getSettings = () => useSettingsStore()
  const getNavigation = () => useNavigationStore()
  const getUi = () => useUiStore()

  return {
    version: packageVersion,
    title: packageTitle,
    settings: getSettings(),
    navigation: getNavigation(),
    ui: getUi(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
