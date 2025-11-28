import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed } from 'vue'
import { version as packageVersion, title as packageTitle } from '../../package.json'
import { useHttp } from '@/composables/http'
import { useSettingsStore } from './app/settings'
import { useNavigationStore } from './app/navigation'
import { useUiStore } from './app/ui'
import { useAuthStore } from './app/auth'
import { useAuditStore } from './app/audit'

export const useAppStore = defineStore(
  'app',
  () => {
    const getSettings = () => useSettingsStore()
    const getNavigation = () => useNavigationStore()
    const getUi = () => useUiStore()
    const getAuth = () => useAuthStore()
    const getAudit = () => useAuditStore()

    type ContextResponse = {
      version: string
      user?: {
        uuid: string
        username: string
        fullname: string
        created: string
        privileges: {
          role: string
          permission: string
          validfrom: string
          validto: string
        }[]
      }[]
      consents: {
        id: string
        language: string
        name: string
        created: string
      }[]
      config: {
        key: string
        value: string
      }[]
    }

    const defaultUser = {
      uuid: '',
      username: '',
      fullname: '',
      created: '',
      privileges: [] as {
        role: string
        permission: string
        validfrom: string
        validto: string
      }[],
    }

    const version = ref(`v${packageVersion}`)
    const title = ref(packageTitle)
    const user = ref(defaultUser)
    const consents = ref<ContextResponse['consents']>([])
    const config = ref<ContextResponse['config']>([])

    const appPerformanceThresholdMs = computed(() => {
      const setting = config.value.find((c) => c.key === 'APP_PERFORMANCE_THRESHOLD_MS')
      return setting ? parseInt(setting.value, 10) : 250
    })

    const api = useHttp()

    async function init() {
      const { data } = await api<ContextResponse>('app/context/')
      const dbVersion = data?.version
      const isDev = import.meta.env.DEV ? '-dev' : ''
      version.value =
        dbVersion == `v${packageVersion}`
          ? `v${packageVersion}${isDev}`
          : `v${packageVersion}-${dbVersion}${isDev}`
      user.value = data?.user?.[0] ?? defaultUser
      consents.value = data?.consents ?? []
      config.value = data?.config ?? []
    }

    return {
      init,
      version,
      title,
      user,
      consents,
      config,
      appPerformanceThresholdMs,
      settings: getSettings(),
      navigation: getNavigation(),
      ui: getUi(),
      auth: getAuth(),
      audit: getAudit(),
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
