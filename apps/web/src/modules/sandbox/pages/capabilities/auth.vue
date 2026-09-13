<template>
  <v-container>
    <v-row align="center">
      <v-col cols="12" md>
        <h3>Authentication laboratory</h3>
        <p class="text-medium-emphasis">Live ORDS authentication with in-memory access tokens.</p>
      </v-col>
      <v-col cols="auto">
        <v-chip
          :color="auth.authenticated.value ? 'success' : 'secondary'"
          prepend-icon="$mdiShieldAccount"
        >
          {{ auth.authenticated.value ? auth.user.value?.username : 'Identity not loaded' }}
        </v-chip>
      </v-col>
    </v-row>

    <v-row class="mt-2">
      <v-col cols="12" md="6">
        <v-card title="Session" prepend-icon="$mdiKey">
          <v-card-text>
            <v-list density="compact">
              <v-list-item title="Ready" :subtitle="String(auth.ready.value)" />
              <v-list-item title="Access token" :subtitle="auth.accessToken.value ?? 'None'" />
              <v-list-item title="Refresh token" :subtitle="auth.refreshToken.value ?? 'None'" />
              <v-list-item
                title="Roles"
                :subtitle="auth.user.value?.roles?.join(', ') ?? 'Not returned by this endpoint'"
              />
            </v-list>
          </v-card-text>
          <v-card-actions>
            <v-btn :loading="auth.loading.value" prepend-icon="$mdiLogin" @click="login"
              >Login as admin</v-btn
            >
            <v-btn :loading="auth.loading.value" prepend-icon="$mdiRefresh" @click="restore"
              >Restore</v-btn
            >
            <v-btn :loading="callingMe" prepend-icon="$mdiAccountSearch" @click="me"
              >Call /me</v-btn
            >
            <v-btn
              :disabled="!auth.accessToken.value"
              :loading="auth.loading.value"
              color="error"
              prepend-icon="$mdiLogout"
              @click="logout"
              >Logout</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card title="Lifecycle" prepend-icon="$mdiTimelineClock">
          <v-card-text>
            <pre class="result">{{
              events.join('\n') || 'Run an action to inspect the flow.'
            }}</pre>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useAuth } from '@odbvue/web'
import { ref } from 'vue'

definePage({
  meta: {
    title: 'Authentication',
    icon: '$mdiShieldAccount',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const events = ref<string[]>([])
const auth = useAuth()
const callingMe = ref(false)

async function login() {
  events.value.push('POST /auth/login')
  await auth.login({ username: 'admin', password: 'ChangeMe123!' })
}
async function restore() {
  events.value.push('POST /auth/refresh')
  await auth.restore()
}
async function me() {
  callingMe.value = true
  try {
    await auth.me()
    events.value.push('GET /auth/me -> 200')
  } catch (error) {
    events.value.push(`GET /auth/me -> ${error instanceof Error ? error.message : 'network error'}`)
  } finally {
    callingMe.value = false
  }
}
async function logout() {
  events.value.push('POST /auth/logout -> session revoked')
  await auth.logout()
}
</script>

<style scoped>
.result {
  min-height: 8rem;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
