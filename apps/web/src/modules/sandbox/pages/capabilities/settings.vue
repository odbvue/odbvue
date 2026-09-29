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
            <v-text-field v-model="value" label="Value" hide-details="auto" maxlength="2000" />
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              prepend-icon="$mdiContentSave"
              :disabled="!id || !auth.authenticated.value || !!busy"
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
            <v-btn
              color="error"
              prepend-icon="$mdiDelete"
              :disabled="!id || !auth.authenticated.value || !!busy"
              :loading="busy === 'remove'"
              @click="remove"
              >Delete</v-btn
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
              v-if="items.length >= pageSize"
              prepend-icon="$mdiChevronRight"
              :disabled="!auth.authenticated.value || !!busy"
              @click="list(items.at(-1)?.id)"
              >Next</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { httpContract, useAuth, useOdbVue } from '@odbvue/web'
import { ref } from 'vue'

definePage({
  meta: {
    title: 'Settings',
    icon: '$mdiCog',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

type Item = { id: string; value: string | null; meta: string }
type Action = 'read' | 'write' | 'remove' | 'list'

const pageSize = 50
const auth = useAuth()
const http = useOdbVue().get(httpContract)
const id = ref('SANDBOX_DEMO')
const value = ref('')
const items = ref<Item[]>([])
const busy = ref<Action>()
const message = ref<{ type: 'success' | 'error'; text: string }>()

const url = () => `/sandbox/settings/${encodeURIComponent(id.value)}`

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
  })

const read = () =>
  run('read', 'Setting loaded.', 'Setting could not be loaded.', async () => {
    const response = await http.get<{ value: string | null }>(url())
    if (response.error || !response.data) throw response.error ?? new Error('Not found')
    value.value = response.data.value ?? ''
  })

const remove = () =>
  run('remove', 'Setting deleted.', 'Setting could not be deleted.', async () => {
    const response = await http.delete(url())
    if (response.error) throw response.error
    value.value = ''
  })

const list = (after?: string) =>
  run('list', 'Settings loaded.', 'Settings could not be loaded.', async () => {
    const response = await http.get<{ items: Item[] }>('/sandbox/settings', {
      headers: after ? { 'X-After': after } : undefined,
    })
    if (response.error || !response.data) throw response.error ?? new Error('No data')
    items.value = response.data.items
  })

function pick(item: Item) {
  id.value = item.id
  value.value = item.value ?? ''
}
</script>
