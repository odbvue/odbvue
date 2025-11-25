import { computed, ref, watch } from 'vue'
import { defineStore, acceptHMRUpdate } from 'pinia'
import { useHttp } from '@/composables/http'
import { useAppStore } from '../index'

type AuditData = {
  severity: string
  message: string
  attributes?: string | Record<string, unknown>
  created?: string
}

export const useAuditStore = defineStore('audit', () => {
  let autoSaveTimer: number | null = null

  let initialData: AuditData[] = []
  try {
    const stored = localStorage.getItem('audit')
    if (stored) initialData = JSON.parse(stored)
  } catch {
    initialData = []
  }

  const data = ref<AuditData[]>(initialData)

  const count = computed(() => data.value.length)

  const log = async (
    severity: string,
    message: string,
    attributes: string | Record<string, unknown> = '',
    saveImmediately = false,
  ) => {
    data.value.push({ severity, message, attributes, created: new Date().toISOString() })
    if (saveImmediately) await save()
  }

  async function inf(
    message: string,
    attributes: string | Record<string, unknown> = '',
    saveImmediately = false,
  ) {
    log('INFO', message, attributes, saveImmediately)
  }

  async function wrn(
    message: string,
    attributes: string | Record<string, unknown> = '',
    saveImmediately = false,
  ) {
    log('WARN', message, attributes, saveImmediately)
  }

  async function err(message: string, attributes: string, saveImmediately = false) {
    log('ERROR', message, attributes, saveImmediately)
  }

  function attrs(data: AuditData[]) {
    for (const item of data) {
      if (item.attributes && typeof item.attributes === 'string') {
        item.attributes = { data: item.attributes }
      }
      const app = useAppStore()
      if (app.user && app.user.uuid) {
        item.attributes = {
          ...(item.attributes as Record<string, unknown>),
          uuid: app.user.uuid,
        }
      }
    }
    return data
  }

  async function save() {
    if (data.value.length) {
      try {
        const http = useHttp()
        await http.post('app/audit/', { data: JSON.stringify(attrs(data.value)) })
      } catch (error) {
        err('Failed to save audit log', (error as Error).message)
        if (import.meta.env.DEV) console.error('Failed to save audit log', data.value)
      } finally {
        data.value = []
      }
    }
    const errors = JSON.parse(localStorage.getItem('errors') || '[]')
    if (errors.length) {
      try {
        const http = useHttp()
        await http.post('app/audit/', { data: JSON.stringify(attrs(errors)) })
      } catch (error) {
        err('Failed to save error log', (error as Error).message)
        if (import.meta.env.DEV) console.error('Failed to save error log', errors)
      } finally {
        localStorage.removeItem('errors')
      }
    }
  }

  function startAutoSave() {
    if (!autoSaveTimer) {
      autoSaveTimer = window.setInterval(save, 60000)
    }
  }

  function stopAutoSave() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
  }

  watch(
    () => data.value,
    (newData: AuditData[]) => {
      try {
        localStorage.setItem('audit', JSON.stringify(newData))
      } finally {
        // do nothing
      }
    },
    { deep: true },
  )

  return {
    inf,
    wrn,
    err,
    count,
    save,
    startAutoSave,
    stopAutoSave,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuditStore, import.meta.hot))
}
