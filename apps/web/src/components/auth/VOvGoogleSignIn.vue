<template>
  <v-btn
    v-if="enabled"
    class="mt-4"
    block
    variant="outlined"
    :disabled="!auth.ready.value || auth.loading.value || starting"
    @click="start"
  >
    {{ t('auth.google.continue') }}
  </v-btn>
</template>

<script setup lang="ts">
import { useAuth } from '@/capabilities/auth'
import { appConfig } from '@/capabilities/config'
import { resolveAuthRedirect } from '@/capabilities/routing'
import { useUi } from '@/capabilities/ui'

const auth = useAuth()
const ui = useUi()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const enabled = computed(() => auth.providers.value?.google === true)
const starting = ref(false)

async function start() {
  if (!enabled.value || !auth.ready.value || auth.loading.value || starting.value) return
  starting.value = true
  ui.clear()
  ui.startLoading()
  try {
    const redirect = resolveAuthRedirect(
      router,
      route.query.redirect,
      appConfig.auth?.routes?.authenticated ?? '/',
      appConfig.auth?.routes?.login ?? '/login',
    )
    const { authorizationUrl } = await auth.startGoogleLogin({ redirect })
    window.location.assign(authorizationUrl)
  } catch (error) {
    starting.value = false
    ui.error(error)
  } finally {
    ui.stopLoading()
  }
}
</script>
