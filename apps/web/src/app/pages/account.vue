<template>
  <v-container max-width="960">
    <h1 class="mb-6">{{ t('auth.account.title') }}</h1>
    <v-alert v-if="continuing" type="info" variant="tonal" class="mb-4">
      {{ t('auth.google.link.continue') }}
    </v-alert>
    <v-card variant="outlined" class="mb-6">
      <v-card-text>
        <div class="d-flex align-center ga-4 mb-6">
          <v-avatar color="primary" :size="80">
            <v-img
              v-if="auth.user.value?.avatarUrl"
              :src="auth.user.value.avatarUrl"
              alt=""
              referrerpolicy="no-referrer"
            >
              <template #error
                ><span>{{ initials }}</span></template
              >
            </v-img>
            <span v-else>{{ initials }}</span>
          </v-avatar>
          <div>
            <h2 class="text-h5">{{ auth.user.value?.displayName || auth.user.value?.username }}</h2>
            <p class="text-body-2 text-medium-emphasis">{{ auth.user.value?.username }}</p>
          </div>
        </div>
        <v-row>
          <v-col cols="12" sm="6">
            <v-text-field
              :model-value="auth.user.value?.displayName"
              :label="t('auth.full.name')"
              readonly
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              :model-value="auth.user.value?.username"
              :label="t('auth.email')"
              readonly
              hide-details
            />
          </v-col>
        </v-row>
        <h3 class="text-subtitle-1 mt-6 mb-2">{{ t('auth.profile.avatar.title') }}</h3>
        <p class="text-body-2 mb-3">{{ t('auth.profile.avatar.description') }}</p>
        <v-file-input
          v-model="file"
          :label="t('auth.profile.avatar.choose')"
          accept="image/jpeg,image/png,image/webp"
          :disabled="busy"
          :loading="avatarSaving"
          show-size
          @update:model-value="uploadAvatar"
        />
        <v-btn
          v-if="auth.user.value?.avatarUploaded"
          variant="text"
          :disabled="busy"
          @click="removeAvatar"
        >
          {{ t('auth.profile.avatar.remove') }}
        </v-btn>
      </v-card-text>
    </v-card>
    <v-card variant="outlined" class="mb-6">
      <v-card-title
        ><h2 class="text-h6">{{ t('auth.profile.providers') }}</h2></v-card-title
      >
      <v-card-text>
        <div class="d-flex justify-space-between align-center mb-3">
          <span>{{ t('auth.profile.password.provider') }}</span>
          <v-chip :color="auth.user.value?.passwordConnected ? 'success' : undefined" size="small">
            {{ providerStatus(auth.user.value?.passwordConnected) }}
          </v-chip>
        </div>
        <v-divider class="mb-3" />
        <div class="d-flex justify-space-between align-center mb-3">
          <span>Google</span>
          <v-chip :color="auth.user.value?.googleConnected ? 'success' : undefined" size="small">
            {{ providerStatus(auth.user.value?.googleConnected) }}
          </v-chip>
        </div>
        <p v-if="auth.user.value?.googleConnected" class="text-body-2">
          {{ t('auth.profile.google.connected') }}
        </p>
        <template v-else-if="enabled && auth.user.value?.passwordConnected">
          <p class="mb-4">{{ t('auth.google.link.description') }}</p>
          <form @submit.prevent="connect">
            <v-text-field
              v-model="linkPassword"
              type="password"
              :label="t('auth.google.link.password')"
              autocomplete="current-password"
              :disabled="busy"
              required
            />
            <v-btn type="submit" color="primary" :loading="starting" :disabled="!canConnect">{{
              t('auth.google.connect')
            }}</v-btn>
          </form>
        </template>
        <p v-else-if="enabled === false" class="text-body-2">
          {{ t('auth.profile.google.disabled') }}
        </p>
      </v-card-text>
    </v-card>
    <v-card variant="outlined">
      <v-card-title
        ><h2 class="text-h6">{{ t('auth.profile.security') }}</h2></v-card-title
      >
      <v-card-text>
        <template v-if="auth.user.value?.passwordConnected && auth.providers.value?.password">
          <h3 class="text-subtitle-1 mb-2">{{ t('auth.profile.password.change') }}</h3>
          <p class="mb-4">{{ t('auth.profile.password.description') }}</p>
          <v-ov-form
            :options="passwordOptions"
            :data="passwordData"
            :t="t"
            :key="passwordFormKey"
            @submit="changePassword"
          />
        </template>
        <p
          v-else-if="auth.user.value?.passwordConnected && auth.providers.value?.password === false"
        >
          {{ t('auth.password.disabled') }}
        </p>
        <p v-else>
          {{
            t(
              auth.user.value?.passwordConnected === false
                ? 'auth.profile.password.external'
                : 'auth.profile.providers.unknown',
            )
          }}
        </p>
      </v-card-text>
    </v-card>
    <v-btn
      v-if="continuing"
      class="mt-4"
      variant="text"
      :disabled="busy"
      @click="router.replace(destination)"
    >
      {{ t('auth.google.link.skip') }}
    </v-btn>
  </v-container>
</template>

<script setup lang="ts">
import type { OvFormData, OvFormOptions } from '@/components'
import { useAuth } from '@/capabilities/auth'
import { avatarInitials, createAvatar } from '@/capabilities/auth/avatar'
import { useUi } from '@/capabilities/ui'
import { resolveAuthRedirect } from '@/capabilities/routing'

definePage({ meta: { title: 'Profile', access: 'authenticated', navigation: false } })

const auth = useAuth()
const ui = useUi()
const initials = computed(() => avatarInitials(auth.user.value))
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const enabled = computed(() => auth.providers.value?.google)
const starting = ref(false)
const avatarSaving = ref(false)
const changingPassword = ref(false)
const linkPassword = ref('')
const file = shallowRef<File | File[] | null>(null)
const passwordData = ref<OvFormData>({ currentPassword: '', password: '', passwordRepeat: '' })
const passwordFormKey = ref(0)
const busy = computed(
  () => starting.value || avatarSaving.value || changingPassword.value || ui.loading.has('auth'),
)
const destination = computed(() => resolveAuthRedirect(router, route.query.redirect, '/account'))
const continuing = computed(() => destination.value !== '/account')
const canConnect = computed(
  () =>
    enabled.value &&
    auth.ready.value &&
    auth.authenticated.value &&
    !busy.value &&
    !!linkPassword.value &&
    auth.user.value?.passwordConnected &&
    !auth.user.value?.googleConnected,
)
const passwordOptions = computed<OvFormOptions>(() => ({
  disabled: busy.value,
  fields: [
    {
      type: 'password',
      name: 'currentPassword',
      label: 'auth.google.link.password',
      autocomplete: 'current-password',
      rules: [{ type: 'required', params: true, message: 'auth.password.required' }],
    },
    {
      type: 'password',
      name: 'password',
      label: 'auth.profile.password.new',
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
  actions: [
    {
      name: 'change',
      format: { text: 'auth.profile.password.change', color: 'primary', disabled: busy.value },
    },
  ],
  actionSubmit: 'change',
  actionAlign: 'right',
}))

function providerStatus(connected: boolean | undefined) {
  return t(
    connected === undefined
      ? 'auth.profile.unknown'
      : connected
        ? 'auth.profile.connected'
        : 'auth.profile.not.connected',
  )
}

onMounted(async () => {
  try {
    const result = route.query.google
    if (result !== undefined) {
      const query = { ...route.query }
      delete query.google
      await router.replace({ path: route.path, query, hash: route.hash })
      if (result === 'linked') {
        await auth.getState()
        ui.success('auth.google.link.linked')
        if (continuing.value) {
          await router.replace(destination.value)
          return
        }
      } else if (result === 'cancelled') ui.error('auth.google.link.cancelled')
      else if (result === 'conflict') ui.error('auth.google.link.conflict')
      else ui.error('auth.google.link.failed')
    }
  } catch (error) {
    ui.error(error)
  }
})

async function saveAvatar(avatar: string | null) {
  await auth.updateAvatar(avatar)
  ui.success('auth.profile.avatar.saved')
}

async function uploadAvatar(value: File | File[] | null) {
  const selected = Array.isArray(value) ? value[0] : value
  if (!selected || busy.value) return
  avatarSaving.value = true
  ui.clear()
  try {
    await saveAvatar(await createAvatar(selected))
  } catch (error) {
    ui.error(error)
  } finally {
    file.value = null
    avatarSaving.value = false
  }
}

async function removeAvatar() {
  if (busy.value) return
  avatarSaving.value = true
  ui.clear()
  try {
    await saveAvatar(null)
  } catch (error) {
    ui.error(error)
  } finally {
    avatarSaving.value = false
  }
}

async function changePassword(values: OvFormData) {
  if (busy.value || !auth.ready.value) return
  changingPassword.value = true
  ui.clear()
  try {
    await auth.changePassword({
      currentPassword: String(values.currentPassword ?? ''),
      password: String(values.password ?? ''),
      passwordRepeat: String(values.passwordRepeat ?? ''),
    })
    await router.replace('/login')
    ui.success('auth.profile.password.changed')
  } catch (error) {
    const response = error instanceof Error && 'data' in error ? error.data : undefined
    const code =
      response && typeof response === 'object' && 'code' in response ? response.code : undefined
    if (code === 'PASSWORD_CHANGE_CURRENT_INVALID') ui.error('auth.profile.password.incorrect')
    else ui.error(error)
  } finally {
    passwordData.value = { currentPassword: '', password: '', passwordRepeat: '' }
    passwordFormKey.value++
    changingPassword.value = false
  }
}

async function connect() {
  if (!canConnect.value) return
  starting.value = true
  ui.clear()
  const stopLoading = ui.loading.start('overlay.auth.googleLink')
  const currentPassword = linkPassword.value
  linkPassword.value = ''
  try {
    const { authorizationUrl } = await auth.startGoogleLink({
      redirect: destination.value,
      password: currentPassword,
    })
    window.location.assign(authorizationUrl)
  } catch (error) {
    starting.value = false
    const status = error instanceof Error && 'status' in error ? error.status : undefined
    const response = error instanceof Error && 'data' in error ? error.data : undefined
    const code =
      response && typeof response === 'object' && 'code' in response ? response.code : undefined
    if (code === 'GOOGLE_CONFIG_INVALID') ui.error('auth.google.link.configuration')
    else if (status === 401 || status === 403) ui.error('auth.google.link.reauthenticate')
    else if (status === 409) ui.error('auth.google.link.conflict')
    else if (status === 429) ui.error('auth.too.many.requests')
    else ui.error('auth.google.link.failed')
  } finally {
    stopLoading()
  }
}
</script>
