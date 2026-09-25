<template>
  <v-container>
    <v-row align="center">
      <v-col cols="12" md>
        <h3>Settings</h3>
      </v-col>
      <v-col cols="12" md="auto">
        <v-chip
          :color="auth.authenticated.value ? 'success' : 'warning'"
          prepend-icon="$mdiShieldLock"
        >
          {{ auth.authenticated.value ? 'Authenticated' : 'Authentication required' }}
        </v-chip>
      </v-col>
    </v-row>

    <v-alert
      v-if="message"
      class="mt-2"
      :type="message.type"
      :text="message.text"
      closable
      @click:close="message = undefined"
    />

    <v-row class="mt-2">
      <v-col v-for="kind in kinds" :key="kind" cols="12" md="6">
        <v-card
          :title="kind === 'regular' ? 'Regular setting' : 'Secret setting'"
          :prepend-icon="kind === 'regular' ? '$mdiCog' : '$mdiDatabaseLock'"
        >
          <v-card-text>
            <v-text-field
              v-model="settings[kind].id"
              label="Setting ID"
              hide-details="auto"
              class="mb-3"
            />
            <v-text-field
              v-model="settings[kind].value"
              label="Value"
              :type="kind === 'secret' && !showSecret ? 'password' : 'text'"
              :autocomplete="kind === 'secret' ? 'new-password' : 'off'"
              :append-inner-icon="
                kind === 'secret' ? (showSecret ? '$mdiEyeOff' : '$mdiEye') : undefined
              "
              hide-details="auto"
              @click:append-inner="showSecret = !showSecret"
            />
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              prepend-icon="$mdiContentSave"
              :disabled="!settings[kind].id || !settings[kind].value || !auth.authenticated.value"
              :loading="settings[kind].writing"
              @click="write(kind)"
              >Write</v-btn
            >
            <v-btn
              prepend-icon="$mdiDatabaseSearch"
              :disabled="!settings[kind].id || !auth.authenticated.value"
              :loading="settings[kind].reading"
              @click="read(kind)"
              >Read</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { httpContract, useAuth, useOdbVue } from '@odbvue/web'
import { reactive, ref } from 'vue'

definePage({
  meta: {
    title: 'Settings',
    icon: '$mdiCog',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

type Kind = 'regular' | 'secret'
type Message = { type: 'success' | 'error'; text: string }

const kinds: Kind[] = ['regular', 'secret']
const settings = reactive({
  regular: { id: 'SANDBOX_DEMO', value: '', reading: false, writing: false },
  secret: { id: 'SANDBOX_SECRET', value: '', reading: false, writing: false },
})
const auth = useAuth()
const http = useOdbVue().get(httpContract)
const message = ref<Message>()
const showSecret = ref(false)

function url(kind: Kind) {
  return `/settings/${kind === 'secret' ? 'secret/' : ''}${encodeURIComponent(settings[kind].id)}`
}

async function write(kind: Kind) {
  settings[kind].writing = true
  try {
    const response = await http.put(url(kind), { value: settings[kind].value })
    if (response.error) throw response.error
    if (kind === 'secret') settings[kind].value = ''
    message.value = { type: 'success', text: 'Setting saved.' }
  } catch {
    message.value = { type: 'error', text: 'Setting could not be saved.' }
  } finally {
    settings[kind].writing = false
  }
}

async function read(kind: Kind) {
  settings[kind].reading = true
  try {
    const response = await http.get<{ value: string }>(url(kind))
    if (response.error || !response.data) throw response.error ?? new Error('Setting not found.')
    settings[kind].value = response.data.value
    message.value = { type: 'success', text: 'Setting loaded.' }
  } catch {
    message.value = { type: 'error', text: 'Setting could not be loaded.' }
  } finally {
    settings[kind].reading = false
  }
}
</script>
