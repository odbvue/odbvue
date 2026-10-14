<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <h1 class="mb-4">{{ t('auth.recover.title') }}</h1>
        <v-alert v-if="submitted" type="success" variant="tonal" class="mb-4">
          {{ t('auth.recover.sent') }}
        </v-alert>
        <template v-else>
          <p class="mb-4">{{ t('auth.recover.description') }}</p>
          <v-ov-form :options="options" :data="data" :t="t" @submit="submit" />
        </template>
        <v-btn to="/login" variant="text" class="mt-4">{{ t('auth.login') }}</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { OvFormData, OvFormOptions } from '@/components'
import { useAuth } from '@/capabilities/auth'
import { useUi } from '@/capabilities/ui'

definePage({ meta: { title: 'Recover password', access: 'anonymous', navigation: false } })

const auth = useAuth()
const ui = useUi()
const { t } = useI18n()
const submitted = ref(false)
const data = ref<OvFormData>({ email: '' })
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
  ],
  actions: [{ name: 'recover', format: { text: 'auth.recover.action', color: 'primary' } }],
  actionSubmit: 'recover',
  actionAlign: 'right',
  focusFirst: true,
}

async function submit(values: OvFormData) {
  if (auth.loading.value || !auth.ready.value || submitted.value) return
  ui.clear()
  ui.startLoading()
  const email = String(values.email ?? '').trim()
  try {
    await auth.recoverPassword(email)
    submitted.value = true
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? error.status : undefined
    if (status === 429) ui.error('auth.signup.too.many.requests')
    else ui.error(error)
  } finally {
    data.value = { email }
    ui.stopLoading()
  }
}
</script>
