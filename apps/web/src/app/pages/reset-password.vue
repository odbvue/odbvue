<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <h1 class="mb-4">{{ t('auth.reset.title') }}</h1>
        <v-alert v-if="completed" type="success" variant="tonal" class="mb-4">
          {{ t('auth.reset.success') }}
        </v-alert>
        <v-alert v-else-if="invalid" type="error" variant="tonal" class="mb-4">
          {{ t('auth.reset.invalid') }}
        </v-alert>
        <v-ov-form v-else :options="options" :data="data" :t="t" @submit="submit" />
        <v-btn to="/login" variant="text" class="mt-4">{{ t('auth.login') }}</v-btn>
        <v-btn v-if="invalid" to="/recover-password" variant="text" class="mt-4">
          {{ t('auth.recover.action') }}
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { OvFormData, OvFormOptions } from '@/components'
import { useAuth } from '@/capabilities/auth'
import { useUi } from '@/capabilities/ui'

definePage({ meta: { title: 'Reset password', access: 'public', navigation: false } })

const auth = useAuth()
const ui = useUi()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const token = ref(new URLSearchParams(route.hash.slice(1)).get('token') ?? '')
const invalid = ref(!/^[A-F0-9]{64}$/.test(token.value))
const completed = ref(false)
const data = ref<OvFormData>({ password: '', passwordRepeat: '' })
const options: OvFormOptions = {
  fields: [
    {
      type: 'password',
      name: 'password',
      label: 'auth.password',
      autocomplete: 'new-password',
      rules: [
        { type: 'required', params: true, message: 'auth.password.required' },
        { type: 'min-length', params: 8, message: 'auth.password.length' },
        { type: 'max-length', params: 256, message: 'auth.password.length' },
      ],
    },
    {
      type: 'password',
      name: 'passwordRepeat',
      label: 'auth.password.repeat',
      autocomplete: 'new-password',
      rules: [
        { type: 'required', params: true, message: 'auth.password.required' },
        { type: 'same-as', params: 'password', message: 'auth.password.mismatch' },
      ],
    },
  ],
  actions: [{ name: 'reset', format: { text: 'auth.reset.action', color: 'primary' } }],
  actionSubmit: 'reset',
  actionAlign: 'right',
  focusFirst: true,
}

onMounted(async () => {
  if (route.hash) await router.replace({ path: route.path, query: route.query, hash: '' })
})

async function submit(values: OvFormData) {
  if (auth.loading.value || !auth.ready.value || invalid.value || completed.value) return
  ui.clear()
  const password = String(values.password ?? '')
  const passwordRepeat = String(values.passwordRepeat ?? '')
  if (password !== passwordRepeat) {
    ui.error('auth.password.mismatch')
    data.value = { password: '', passwordRepeat: '' }
    return
  }
  ui.startLoading()
  try {
    await auth.resetPassword({ token: token.value, password, passwordRepeat })
    completed.value = true
    token.value = ''
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? error.status : undefined
    const response = error instanceof Error && 'data' in error ? error.data : undefined
    const code =
      response && typeof response === 'object' && 'code' in response ? response.code : undefined
    if (status === 422 && code === 'PASSWORD_RESET_INVALID') {
      invalid.value = true
      token.value = ''
    } else if (status === 422 && code === 'PASSWORD_RESET_PASSWORD_INVALID') {
      ui.error('auth.password.length')
    } else if (status === 422 && code === 'PASSWORD_RESET_PASSWORD_MISMATCH') {
      ui.error('auth.password.mismatch')
    } else if (status === 429) ui.error('auth.signup.too.many.requests')
    else ui.error(error)
  } finally {
    data.value = { password: '', passwordRepeat: '' }
    ui.stopLoading()
  }
}
</script>
