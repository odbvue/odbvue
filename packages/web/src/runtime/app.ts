import { defineStore, acceptHMRUpdate } from 'pinia'
import { useOdbVue } from './context.js'
import { useSettingsStore } from '../capabilities/ui/settings.js'
import { useUiStore } from '../capabilities/ui/store.js'

export const useAppStore = defineStore('app', () => {
  const { config } = useOdbVue()

  return {
    version: config.version ?? '',
    title: config.title ?? 'OdbVue',
    settings: useSettingsStore(),
    ui: useUiStore(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
