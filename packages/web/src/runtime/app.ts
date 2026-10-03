import { defineStore, acceptHMRUpdate } from 'pinia'
import { useOdbVue } from './context.js'
import { usePreferencesStore } from '../capabilities/ui/preferences.js'
import { useUi } from '../capabilities/ui/store.js'

export const useAppStore = defineStore('app', () => {
  const { config } = useOdbVue()

  return {
    version: config.version ?? '',
    title: config.title ?? 'OdbVue',
    preferences: usePreferencesStore(),
    ui: useUi(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
