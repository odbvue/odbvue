<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="6">
        <h1 class="mb-4">{{ t('auth.account.title') }}</h1>
        <p class="mb-4">{{ auth.user.value?.username }}</p>
        <template v-if="enabled">
          <h2 class="mb-4">{{ t('auth.google.connect') }}</h2>
          <p class="mb-4">{{ t('auth.google.link.description') }}</p>
          <form @submit.prevent="connect">
            <v-text-field
              v-model="password"
              type="password"
              :label="t('auth.google.link.password')"
              autocomplete="current-password"
              :disabled="starting || auth.loading.value"
              required
            />
            <v-btn type="submit" color="primary" :loading="starting" :disabled="!canConnect">
              {{ t('auth.google.connect') }}
            </v-btn>
          </form>
        </template>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useAuth } from '@/capabilities/auth'
import { useUi } from '@/capabilities/ui'

definePage({
  meta: {
    title: 'Account settings',
    access: 'authenticated',
    navigation: false,
  },
})

const auth = useAuth()
const ui = useUi()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const enabled = ref(false)
const starting = ref(false)
const password = ref('')
const canConnect = computed(
  () =>
    enabled.value &&
    auth.ready.value &&
    auth.authenticated.value &&
    !auth.loading.value &&
    !starting.value &&
    !!password.value,
)

onMounted(async () => {
  const result = route.query.google
  if (result !== undefined) {
    const query = { ...route.query }
    delete query.google
    await router.replace({ path: route.path, query, hash: route.hash })
    if (result === 'linked') ui.success('auth.google.link.linked')
    else if (result === 'cancelled') ui.error('auth.google.link.cancelled')
    else if (result === 'conflict') ui.error('auth.google.link.conflict')
    else ui.error('auth.google.link.failed')
  }
  try {
    enabled.value = (await auth.getGoogleConfig()).enabled
  } catch (error) {
    ui.error(error)
  }
})

async function connect() {
  if (!canConnect.value) return
  starting.value = true
  ui.clear()
  ui.startLoading()
  const currentPassword = password.value
  password.value = ''
  try {
    const { authorizationUrl } = await auth.startGoogleLink({
      redirect: '/account',
      password: currentPassword,
    })
    window.location.assign(authorizationUrl)
  } catch (error) {
    starting.value = false
    const status = error instanceof Error && 'status' in error ? error.status : undefined
    if (status === 401 || status === 403) ui.error('auth.google.link.reauthenticate')
    else if (status === 409) ui.error('auth.google.link.conflict')
    else if (status === 429) ui.error('auth.too.many.requests')
    else ui.error('auth.google.link.failed')
  } finally {
    ui.stopLoading()
  }
}
</script>
