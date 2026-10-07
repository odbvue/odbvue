<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <h1 class="mb-4">{{ t('auth.login') }}</h1>
        <v-ov-form
          :options="options"
          :loading="app.auth.loading || !app.auth.ready"
          :t="t"
          @submit="submit"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { OvFormData, OvFormOptions } from '@odbvue/web/components'
import { useAppStore } from '@/stores'
import { loginRedirect } from '@/router/auth'

definePage({
  meta: {
    title: 'Login',
    visibility: 'never',
    access: 'when-unauthenticated',
  },
})

const app = useAppStore()
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
  if (app.auth.loading || !app.auth.ready) return
  if (await app.auth.login(String(data.username), String(data.password))) {
    await router.replace(loginRedirect(router, route.query.redirect))
  }
}
</script>
