import { defineStore, acceptHMRUpdate } from 'pinia'
import { version as packageVersion, title as packageTitle } from '../../package.json'

export const useAppStore = defineStore('app', () => {
  const version = ref(`v${packageVersion}`)
  const title = ref(packageTitle)
  const getSettings = () => useSettingsStore()
  const getNavigation = () => useNavigationStore()
  const getUi = () => useUiStore()

  const api = useHttp()

  onMounted(async () => {
    const { version: dbVersion } = await api('app/context/')
    const isDev = import.meta.env.DEV ? '-dev' : ''
    version.value = `v${packageVersion}-${dbVersion}${isDev}`
  })

  return { version, title, settings: getSettings(), navigation: getNavigation(), ui: getUi() }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
  import.meta.hot.accept(acceptHMRUpdate(useNavigationStore, import.meta.hot))
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
