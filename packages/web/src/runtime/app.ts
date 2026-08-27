import { defineStore, acceptHMRUpdate } from 'pinia'
import { useOdbVue } from './context.js'
import { useSettingsStore } from '../capabilities/ui/settings.js'
import { useNavigationStore } from '../capabilities/routing/navigation.js'
import { useUiStore } from '../capabilities/ui/store.js'

export const useAppStore = defineStore('app', () => {
  const { config } = useOdbVue()

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
