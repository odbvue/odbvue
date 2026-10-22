<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <h1 class="mb-4">{{ t(pending ? 'auth.two.factor.title' : 'auth.login') }}</h1>
        <template v-if="recoveryCodes.length">
          <v-alert type="warning" variant="tonal" class="mb-4">{{
            t('auth.two.factor.save')
          }}</v-alert>
          <ul class="mb-4">
            <li v-for="code in recoveryCodes" :key="code">
              <code>{{ code }}</code>
            </li>
          </ul>
          <v-btn color="primary" @click="finish">{{ t('auth.two.factor.saved') }}</v-btn>
        </template>
        <template v-else-if="pending">
          <template v-if="pending.setupSecret">
            <p class="mb-4">{{ t('auth.two.factor.setup') }}</p>
            <img
              v-if="qrCode"
              :src="qrCode"
              :alt="t('auth.two.factor.qr')"
              width="256"
              height="256"
              class="authenticator-qr d-block mb-4"
            />
            <details :open="qrFailed" class="mb-4">
              <summary>{{ t('auth.two.factor.manual') }}</summary>
              <v-text-field
                :model-value="pending.setupSecret"
                :label="t('auth.two.factor.secret')"
                readonly
                autocomplete="off"
                class="mt-4"
              />
            </details>
            <v-btn :href="authenticatorUri" variant="text" class="mb-4">
              {{ t('auth.two.factor.open') }}
            </v-btn>
          </template>
          <p class="mb-4">
            {{ t(pending.setupSecret ? 'auth.two.factor.enroll' : 'auth.two.factor.description') }}
          </p>
          <form @submit.prevent="verify">
            <v-text-field
              v-model="verificationCode"
              :label="t('auth.two.factor.code')"
              autocomplete="one-time-code"
              :maxlength="32"
              :disabled="auth.loading.value"
              required
              autofocus
            />
            <v-btn type="submit" color="primary" :disabled="auth.loading.value">
              {{ t('auth.two.factor.verify') }}
            </v-btn>
            <v-btn variant="text" :disabled="auth.loading.value" @click="cancel">
              {{ t('auth.two.factor.cancel') }}
            </v-btn>
          </form>
        </template>
        <template v-else>
          <v-ov-form
            v-if="auth.providers.value?.password"
            :options="options"
            :t="t"
            @submit="submit"
          />
          <VOvGoogleSignIn />
          <v-btn
            v-if="auth.signupEnabled.value"
            :to="{
              path: '/signup',
              query: route.query.redirect ? { redirect: route.query.redirect } : {},
            }"
            variant="text"
            class="mt-4"
          >
            {{ t('auth.signup') }}
          </v-btn>
          <v-btn
            v-if="auth.providers.value?.password"
            to="/recover-password"
            variant="text"
            class="mt-4"
          >
            {{ t('auth.recover.title') }}
          </v-btn>
        </template>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'
import type { OvFormData, OvFormOptions } from '@/components'
import { resolveAuthRedirect } from '@/capabilities/routing'
import { useAuth, type AuthChallenge } from '@/capabilities/auth'
import { appConfig } from '@/capabilities/config'
import { useUi } from '@/capabilities/ui'
import VOvGoogleSignIn from '@/components/auth/VOvGoogleSignIn.vue'

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
const pending = shallowRef<AuthChallenge | null>(null)
const verificationCode = ref('')
const recoveryCodes = shallowRef<readonly string[]>([])
const loginUsername = ref('')
const qrCode = ref('')
const qrFailed = ref(false)
const authenticatorIssuer = appConfig.title ?? 'OdbVue'
const authenticatorUri = computed(() =>
  pending.value?.setupSecret
    ? `otpauth://totp/${encodeURIComponent(`${authenticatorIssuer}:${loginUsername.value}`)}?secret=${pending.value.setupSecret}&issuer=${encodeURIComponent(authenticatorIssuer)}&algorithm=SHA1&digits=6&period=30`
    : '',
)

watch(authenticatorUri, async (uri, _previous, onCleanup) => {
  qrCode.value = ''
  qrFailed.value = false
  if (!uri) return
  let current = true
  onCleanup(() => {
    current = false
  })
  try {
    const svg = await QRCode.toString(uri, {
      type: 'svg',
      width: 256,
      margin: 4,
      errorCorrectionLevel: 'M',
    })
    if (current) qrCode.value = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  } catch {
    if (current) {
      qrFailed.value = true
      ui.error('auth.two.factor.qr.failed')
    }
  }
})

function cancel() {
  pending.value = null
  verificationCode.value = ''
  loginUsername.value = ''
}

onBeforeUnmount(() => {
  cancel()
  recoveryCodes.value = []
})

onMounted(async () => {
  const result = route.query.google
  if (result === undefined) return
  const query = { ...route.query }
  delete query.google
  // Restoration and successful callback navigation belong to the existing auth guard.
  await router.replace({ path: route.path, query, hash: route.hash })
  if (result === 'cancelled') ui.error('auth.google.cancelled')
  else if (result === 'conflict') ui.error('auth.google.conflict')
  else if (result !== 'success') ui.error('auth.google.failed')
})

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
    const challenge = await auth.login({
      username: String(data.username),
      password: String(data.password),
    })
    if (challenge) {
      loginUsername.value = String(data.username)
      pending.value = challenge
      return
    }
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
  await finish()
}

async function verify() {
  if (!pending.value || auth.loading.value) return
  ui.clear()
  ui.startLoading()
  try {
    const result = await auth.verifyTwoFactor(
      pending.value.challenge,
      verificationCode.value.trim(),
    )
    if ('challenge' in result) {
      pending.value = result
      return
    }
    recoveryCodes.value = result.recoveryCodes
    pending.value = null
    verificationCode.value = ''
    if (!recoveryCodes.value.length) await finish()
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? error.status : undefined
    if (status === 401) ui.error('auth.two.factor.invalid')
    else if (status === 429) ui.error('auth.too.many.requests')
    else ui.error(error)
  } finally {
    verificationCode.value = ''
    ui.stopLoading()
  }
}

async function finish() {
  recoveryCodes.value = []
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

<style scoped>
.authenticator-qr {
  max-width: 100%;
  height: auto;
}
</style>
