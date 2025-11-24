import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownIt from 'markdown-it'
import { useHttp } from './http'
import { useAppStore } from '../stores'

export function useConsent() {
  const app = useAppStore()
  const { locale } = useI18n()
  const http = useHttp()

  const showDialog = ref(false)
  const consentId = ref('')
  const consentMd = ref('')
  const resolveDialog = ref<((value: string | false) => void) | null>(null)

  const consentHtml = computed(() => {
    const md = new MarkdownIt()
    return md.render(consentMd.value)
  })

  const loadConsent = async () => {
    app.ui.startLoading()
    try {
      const foundConsent = app.consents.find(
        (c: { id: string; language: string; name: string; created: string }) =>
          c.language === locale.value,
      )
      if (foundConsent) {
        consentId.value = foundConsent.id
        const { data } = await http.get<{ consent: string }>(`app/consent/${consentId.value}`)
        consentMd.value = data?.consent ?? ''
      }
    } finally {
      app.ui.stopLoading()
    }
  }

  const askConsent = async (): Promise<string | false> => {
    await loadConsent()
    showDialog.value = true

    return new Promise((resolve) => {
      resolveDialog.value = resolve
    })
  }

  const handleSubmit = () => {
    showDialog.value = false
    resolveDialog.value?.(consentId.value)
  }

  const handleCancel = () => {
    showDialog.value = false
    resolveDialog.value?.(false)
  }

  return {
    showDialog,
    consentHtml,
    askConsent,
    handleSubmit,
    handleCancel,
  }
}
