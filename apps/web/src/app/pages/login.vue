<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <h1 class="mb-4">{{ t('auth.login') }}</h1>
        <v-ov-form :options="options" :t="t" @submit="submit" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { OvFormData, OvFormOptions } from '@/components'
import { resolveAuthRedirect } from '@/capabilities/routing'
import { useAuth } from '@/capabilities/auth'
import { appConfig } from '@/capabilities/config'
import { useUi } from '@/capabilities/ui'

definePage({
  meta: {
    title: 'Login',
    access: 'anonymous',
    navigation: false,
  },
})

const auth = useAuth()
const ui = useUi()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const options: OvFormOptions = {
  fields: [
    {
      type: 'text',
      name: 'username',
      label: 'auth.username',
      autocomplete: 'username',
      rules: [{ type: 'required', params: true, message: 'auth.username.required' }],
    },
    {
      type: 'password',
      name: 'password',
      label: 'auth.password',
      autocomplete: 'current-password',
      rules: [{ type: 'required', params: true, message: 'auth.password.required' }],
    },
  ],
  actions: [{ name: 'login', format: { text: 'auth.login', color: 'primary' } }],
  actionSubmit: 'login',
  actionAlign: 'right',
  focusFirst: true,
}

async function submit(data: OvFormData) {
  if (auth.loading.value || !auth.ready.value) return
  ui.clear()
  ui.startLoading()
  try {
    await auth.login({ username: String(data.username), password: String(data.password) })
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? error.status : undefined
    if (status === 401) ui.error('auth.invalid.credentials')
    else if (status === 403) ui.error('auth.forbidden')
    else if (status === 429) ui.error('auth.too.many.requests')
    else ui.error(error)
    return
  } finally {
    ui.stopLoading()
  }
  await router.replace(
    resolveAuthRedirect(
      router,
      route.query.redirect,
      appConfig.auth?.routes?.authenticated ?? '/',
      appConfig.auth?.routes?.login ?? '/login',
    ),
  )
}
</script>
