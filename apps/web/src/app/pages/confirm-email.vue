<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <h1 class="mb-4">{{ t('auth.confirm.title') }}</h1>
        <v-alert v-if="confirmed" type="success" variant="tonal" class="mb-4">
          {{ t('auth.confirm.success') }}
        </v-alert>
        <v-alert v-else-if="invalid" type="error" variant="tonal" class="mb-4">
          {{ t('auth.confirm.invalid') }}
        </v-alert>
        <template v-else>
          <p class="mb-4">{{ t('auth.confirm.description') }}</p>
          <v-btn color="primary" :disabled="ui.loading.has('auth')" @click="confirm">
            {{ t('auth.confirm.action') }}
          </v-btn>
        </template>
        <v-btn to="/login" variant="text" class="mt-4">{{ t('auth.login') }}</v-btn>
        <v-btn v-if="invalid" to="/signup" variant="text" class="mt-4">{{
          t('auth.signup')
        }}</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useAuth } from '@/capabilities/auth'
import { useUi } from '@/capabilities/ui'

definePage({ meta: { title: 'Confirm email', access: 'public', navigation: false } })

const auth = useAuth()
const ui = useUi()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const token = ref(new URLSearchParams(route.hash.slice(1)).get('token') ?? '')
const invalid = ref(!/^[A-F0-9]{64}$/.test(token.value))
const confirmed = ref(false)

onMounted(async () => {
  if (route.hash) await router.replace({ path: route.path, query: route.query, hash: '' })
})

async function confirm() {
  if (
    ui.loading.has('auth') ||
    ui.loading.has('overlay') ||
    !auth.ready.value ||
    invalid.value ||
    confirmed.value
  )
    return
  ui.clear()
  const stopLoading = ui.loading.start('overlay.auth.confirmEmail')
  try {
    await auth.confirmEmail(token.value)
    confirmed.value = true
    token.value = ''
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? error.status : undefined
    if (status === 422) {
      invalid.value = true
      token.value = ''
    } else if (status === 429) ui.error('auth.signup.too.many.requests')
    else ui.error(error)
  } finally {
    stopLoading()
  }
}
</script>
