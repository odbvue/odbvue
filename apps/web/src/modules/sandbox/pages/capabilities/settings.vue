<template>
  <v-container>
    <v-row align="center">
      <v-col cols="12" md>
        <h3>Settings</h3>
        <p class="text-medium-emphasis">
          Write and read settings through pck_sandbox → odb_settings.
        </p>
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
      <v-col cols="12" md="5">
        <v-card title="Setting" prepend-icon="$mdiCog">
          <v-card-text>
            <v-text-field
              v-model="id"
              label="ID"
              hide-details="auto"
              class="mb-3"
              maxlength="128"
            />
            <v-text-field
              v-model="value"
              :label="secret ? 'New secret value' : 'Value'"
              :type="secret ? 'password' : 'text'"
              :placeholder="secret ? 'Stored value is hidden' : undefined"
              :readonly="!editable"
              :hint="
                trustedSetup
                  ? 'Managed through trusted setup.'
                  : secret
                    ? 'Enter a replacement; the stored secret cannot be read.'
                    : undefined
              "
              :persistent-hint="secret || trustedSetup"
              hide-details="auto"
              maxlength="2000"
            />
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              prepend-icon="$mdiContentSave"
              :disabled="!editable || !auth.authenticated.value || !!busy || (secret && !value)"
              :loading="busy === 'write'"
              @click="write"
              >Write</v-btn
            >
            <v-btn
              prepend-icon="$mdiDatabaseSearch"
              :disabled="!id || !auth.authenticated.value || !!busy"
              :loading="busy === 'read'"
              @click="read"
              >Read</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="7">
        <v-card title="All settings" prepend-icon="$mdiDatabaseSearch">
          <v-table density="compact">
            <thead>
              <tr>
                <th>ID</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id" class="cursor-pointer" @click="pick(item)">
                <td>{{ item.id }}</td>
                <td>{{ item.value }}</td>
              </tr>
              <tr v-if="!items.length">
                <td colspan="2" class="text-medium-emphasis">Nothing loaded.</td>
              </tr>
            </tbody>
          </v-table>
          <v-card-actions>
            <v-btn
              prepend-icon="$mdiRefresh"
              :disabled="!auth.authenticated.value || !!busy"
              :loading="busy === 'list'"
              @click="list()"
              >Load</v-btn
            >
            <v-btn
              v-if="nextCursor"
              prepend-icon="$mdiChevronRight"
              :disabled="!auth.authenticated.value || !!busy"
              @click="list(nextCursor)"
              >Next</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useAuth } from '@/capabilities/auth'
import { useHttp } from '@/capabilities/http'
import { computed, ref, watch } from 'vue'
import type { components } from '@/api/openapi.generated'

definePage({
  meta: {
    title: 'Settings',
    icon: '$mdiCog',
    access: ['admin'],
    navigation: true,
  },
})

type Item = components['schemas']['SandboxListSettingsItemsItem']
type Action = 'read' | 'write' | 'list'

const pageSize = 50
const auth = useAuth()
const http = useHttp()
const id = ref('SANDBOX_DEMO')
const value = ref('')
const items = ref<Item[]>([])
const loaded = ref<{ id: string; meta: unknown; readonly?: string | null }>()
const secretMeta = (meta: unknown) =>
  meta !== null && typeof meta === 'object' && 'secret' in meta && meta.secret === 'Y'
const current = computed(() =>
  loaded.value?.id === id.value ? loaded.value : items.value.find((item) => item.id === id.value),
)
const secret = computed(() => secretMeta(current.value?.meta))
const trustedSetup = computed(() => current.value?.readonly === 'Y')
const editable = computed(() => current.value?.readonly === 'N')
const nextCursor = ref<string>()
const busy = ref<Action>()
const message = ref<{ type: 'success' | 'error'; text: string }>()

const url = () => `/sandbox/settings/${encodeURIComponent(id.value)}`

watch(
  id,
  () => {
    value.value = ''
    loaded.value = undefined
  },
  { flush: 'sync' },
)

async function run(action: Action, success: string, failure: string, call: () => Promise<void>) {
  busy.value = action
  message.value = undefined
  try {
    await call()
    message.value = { type: 'success', text: success }
  } catch {
    message.value = { type: 'error', text: failure }
  } finally {
    busy.value = undefined
  }
}

const write = () =>
  run('write', 'Setting saved.', 'Setting could not be saved.', async () => {
    const response = await http.put(url(), { value: value.value })
    if (response.error) throw response.error
    if (secret.value) value.value = ''
  })

const read = () =>
  run('read', 'Setting loaded.', 'Setting could not be loaded.', async () => {
    const requested = id.value
    const response = await http.get<components['schemas']['SandboxReadSettingResponse']>(url())
    if (response.error || !response.data) throw response.error ?? new Error('Not found')
    if (id.value !== requested) return
    loaded.value = { id: requested, meta: response.data.meta, readonly: response.data.readonly }
    value.value = secret.value ? '' : (response.data.value ?? '')
  })

const list = (cursor?: string) =>
  run('list', 'Settings loaded.', 'Settings could not be loaded.', async () => {
    const query = new URLSearchParams({ limit: String(pageSize) })
    if (cursor) query.set('cursor', cursor)
    const response = await http.get<components['schemas']['SandboxListSettingsResponse']>(
      `/sandbox/settings?${query}`,
    )
    if (response.error || !response.data) throw response.error ?? new Error('No data')
    items.value = response.data.items
    nextCursor.value = response.data.nextCursor
  })

function pick(item: Item) {
  id.value = item.id
  loaded.value = item
  value.value = secret.value ? '' : (item.value ?? '')
}
</script>
