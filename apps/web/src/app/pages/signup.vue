<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <h1 class="mb-4">{{ t('auth.signup') }}</h1>
        <template v-if="submitted">
          <v-alert type="success" variant="tonal" class="mb-4">
            {{ t('auth.signup.sent') }}
          </v-alert>
          <p class="mb-4">{{ t('auth.signup.check.email') }}</p>
        </template>
        <v-ov-form v-else :options="options" :data="data" :t="t" @submit="submit" />
        <v-btn :to="loginLink" variant="text" class="mt-4">{{ t('auth.login') }}</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { OvFormData, OvFormOptions } from '@/components'
import { useAuth } from '@/capabilities/auth'
import { useUi } from '@/capabilities/ui'

definePage({ meta: { title: 'Sign up', access: 'anonymous', navigation: false } })

const auth = useAuth()
const ui = useUi()
const route = useRoute()
const { t } = useI18n()
const submitted = ref(false)
const data = ref<OvFormData>({ email: '', fullName: '', password: '', passwordRepeat: '' })
const loginLink = computed(() => ({
  path: '/login',
  query: route.query.redirect ? { redirect: route.query.redirect } : {},
}))

const options: OvFormOptions = {
  fields: [
    {
      type: 'text',
      name: 'email',
      label: 'auth.email',
      autocomplete: 'email',
      rules: [
        { type: 'required', params: true, message: 'auth.email.required' },
        {
          type: 'regexp',
          params: '^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)+$',
          message: 'auth.email.invalid',
        },
        { type: 'max-length', params: 128, message: 'auth.email.invalid' },
      ],
    },
    {
      type: 'text',
      name: 'fullName',
      label: 'auth.full.name',
      autocomplete: 'name',
      rules: [
        { type: 'required', params: true, message: 'auth.full.name.required' },
        { type: 'regexp', params: '\\S', message: 'auth.full.name.required' },
        { type: 'max-length', params: 256, message: 'auth.full.name.invalid' },
      ],
    },
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
  actions: [{ name: 'signup', format: { text: 'auth.signup', color: 'primary' } }],
  actionSubmit: 'signup',
  actionAlign: 'right',
  focusFirst: true,
}

async function submit(values: OvFormData) {
  if (auth.loading.value || !auth.ready.value || submitted.value) return
  ui.clear()
  const email = String(values.email ?? '').trim()
  const fullName = String(values.fullName ?? '').trim()
  const password = String(values.password ?? '')
  const passwordRepeat = String(values.passwordRepeat ?? '')
  if (password !== passwordRepeat) {
    ui.error('auth.password.mismatch')
    return
  }
  ui.startLoading()
  try {
    await auth.signup({ email, fullName, password, passwordRepeat })
    submitted.value = true
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? error.status : undefined
    if (status === 409) ui.error('auth.signup.email.exists')
    else if (status === 429) ui.error('auth.signup.too.many.requests')
    else ui.error(error)
  } finally {
    data.value = { email, fullName, password: '', passwordRepeat: '' }
    ui.stopLoading()
  }
}
</script>
