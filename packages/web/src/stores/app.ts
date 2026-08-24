import { defineStore, acceptHMRUpdate } from 'pinia'
import { getOdbVueConfig } from '../index.js'
import { useSettingsStore } from './settings.js'
import { useNavigationStore } from './navigation.js'
import { useUiStore } from './ui.js'

export const useAppStore = defineStore('app', () => {
  const config = getOdbVueConfig()

  return {
    version: config.version ?? '',
    title: config.title ?? 'OdbVue',
    settings: useSettingsStore(),
    navigation: useNavigationStore(),
    ui: useUiStore(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
