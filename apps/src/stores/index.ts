import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, onMounted } from 'vue'
import { version as packageVersion, title as packageTitle } from '../../package.json'
import { useHttp } from '@/composables/http'
import { useSettingsStore } from './app/settings'
import { useNavigationStore } from './app/naviagtion'
import { useUiStore } from './app/ui'
import { useAuthStore } from './app/auth'

export const useAppStore = defineStore(
  'app',
  () => {
    const getSettings = () => useSettingsStore()
    const getNavigation = () => useNavigationStore()
    const getUi = () => useUiStore()
    const getAuth = () => useAuthStore()

    type ContextResponse = {
      version: string
      user?: {
        uuid: string
        username: string
        fullname: string
        created: string
      }[]
      consents: {
        id: string
        language: string
        name: string
        created: string
      }[]
    }

    const version = ref(`v${packageVersion}`)
    const title = ref(packageTitle)
    const user = ref({ uuid: '', username: '', fullname: '', created: '' })
    const consents = ref<ContextResponse['consents']>([])

    const api = useHttp()

    async function init() {
      const { data } = await api<ContextResponse>('app/context/')
      const dbVersion = data?.version
      const isDev = import.meta.env.DEV ? '-dev' : ''
      version.value = `v${packageVersion}-${dbVersion}${isDev}`
      user.value = data?.user?.[0] ?? { uuid: '', username: '', fullname: '', created: '' }
      consents.value = data?.consents ?? []
    }

    onMounted(async () => {
      await init()
    })

    return {
      init,
      version,
      title,
      user,
      consents,
      settings: getSettings(),
      navigation: getNavigation(),
      ui: getUi(),
      auth: getAuth(),
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['user'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
