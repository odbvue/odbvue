<template>
  <v-container>
    <v-row align="center">
      <v-col cols="12" md><h3>Audit</h3></v-col>
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
      v-if="notice"
      class="mt-2"
      :type="notice.type"
      :text="notice.text"
      closable
      @click:close="notice = undefined"
    />

    <v-row class="mt-2">
      <v-col cols="12">
        <v-text-field v-model="message" label="Message" maxlength="2000" hide-details="auto" />
        <div class="d-flex flex-wrap ga-2 mt-3">
          <v-btn
            prepend-icon="$mdiInformation"
            color="primary"
            :disabled="!canWrite"
            :loading="busy === 'info'"
            @click="write('info')"
            >Write info</v-btn
          >
          <v-btn
            prepend-icon="$mdiAlert"
            color="warning"
            :disabled="!canWrite"
            :loading="busy === 'warn'"
            @click="write('warn')"
            >Write warn</v-btn
          >
          <v-btn
            prepend-icon="$mdiAlertCircle"
            color="error"
            :disabled="!canWrite"
            :loading="busy === 'error'"
            @click="write('error')"
            >Raise error</v-btn
          >
        </div>
      </v-col>
    </v-row>

    <v-row align="center" class="mt-4">
      <v-col><h4>Audit logs</h4></v-col>
      <v-col cols="auto">
        <v-btn
          prepend-icon="$mdiRefresh"
          :disabled="!auth.authenticated.value || !!busy"
          :loading="busy === 'list'"
          @click="list()"
          >Load</v-btn
        >
      </v-col>
      <v-col v-if="nextCursor" cols="auto">
        <v-btn
          prepend-icon="$mdiChevronRight"
          :disabled="!auth.authenticated.value || !!busy"
          @click="list(nextCursor)"
          >Next</v-btn
        >
      </v-col>
    </v-row>
    <v-table density="compact">
      <thead>
        <tr>
          <th>Time</th>
          <th>Severity</th>
          <th>Message</th>
          <th>Attributes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td class="text-no-wrap">{{ formatTime(item.eventTimestamp) }}</td>
          <td>
            <v-chip size="small" :color="severityColor(item.severityText)">{{
              item.severityText
            }}</v-chip>
          </td>
          <td class="audit-message">{{ item.body }}</td>
          <td>
            <details v-if="item.attributes">
              <summary>Details</summary>
              <pre class="audit-attributes">{{ formatAttributes(item.attributes) }}</pre>
            </details>
          </td>
        </tr>
        <tr v-if="!items.length">
          <td colspan="4" class="text-medium-emphasis">No entries loaded.</td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>

<script setup lang="ts">
import { httpContract, useAuth, useOdbVue } from '@odbvue/web'
import { computed, ref } from 'vue'

definePage({
  meta: {
    title: 'Audit',
    icon: '$mdiClipboardText',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

type Severity = 'info' | 'warn' | 'error'
type Item = {
  id: string
  eventTimestamp: string
  severityText: string
  body: string
  attributes: unknown
}

const pageSize = 50
const auth = useAuth()
const http = useOdbVue().get(httpContract)
const message = ref('Sandbox audit sample')
const items = ref<Item[]>([])
const nextCursor = ref<string>()
const busy = ref<Severity | 'list'>()
const notice = ref<{ type: 'success' | 'error'; text: string }>()
const canWrite = computed(() => auth.authenticated.value && !!message.value.trim() && !busy.value)

async function load(cursor?: string) {
  const query = new URLSearchParams({ limit: String(pageSize + 1) })
  if (cursor) query.set('cursor', cursor)
  const response = await http.get<{ items: Item[] }>(`/sandbox/audit?${query}`)
  if (response.error || !response.data) throw response.error ?? new Error('No data')
  items.value = response.data.items.slice(0, pageSize)
  nextCursor.value = response.data.items.length > pageSize ? items.value.at(-1)?.id : undefined
}

async function list(cursor?: string) {
  busy.value = 'list'
  notice.value = undefined
  try {
    await load(cursor)
  } catch {
    notice.value = { type: 'error', text: 'Audit logs could not be loaded.' }
  } finally {
    busy.value = undefined
  }
}

async function write(severity: Severity) {
  busy.value = severity
  notice.value = undefined
  try {
    const response = await http.post(`/sandbox/audit/${severity}`, { message: message.value })
    const errorData = response.error?.data
    const expectedError =
      severity === 'error' &&
      typeof errorData === 'object' &&
      errorData !== null &&
      'code' in errorData &&
      errorData.code === 'SANDBOX_AUDIT_ERROR'
    notice.value = response.error
      ? { type: 'error', text: expectedError ? 'Sandbox error raised.' : 'Audit request failed.' }
      : { type: 'success', text: `${severity.toUpperCase()} entry written.` }
    try {
      await load()
    } catch {
      notice.value = {
        type: 'error',
        text: `${notice.value.text} Audit logs could not be reloaded.`,
      }
    }
  } catch {
    notice.value = { type: 'error', text: 'Audit request failed.' }
  } finally {
    busy.value = undefined
  }
}

function severityColor(severity: string) {
  if (severity === 'ERROR' || severity === 'FATAL') return 'error'
  if (severity === 'WARN') return 'warning'
  if (severity === 'INFO') return 'info'
  return 'default'
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatAttributes(value: unknown) {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  return JSON.stringify(value, null, 2)
}
</script>

<style scoped>
.audit-message {
  min-width: 12rem;
  max-width: 32rem;
  overflow-wrap: anywhere;
}

.audit-attributes {
  min-width: 12rem;
  max-width: 32rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.75rem;
}
</style>
