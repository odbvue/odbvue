<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-5">
      <h3>Emails</h3>
      <v-chip :color="enabled ? 'success' : 'warning'">
        {{ enabled ? 'Administrator' : 'Administrator sign-in required' }}
      </v-chip>
    </div>

    <v-alert type="info" variant="tonal" class="mb-4">
      Configure the <strong>smtp</strong> setting before sending. Content is sent as HTML.
      Attachments are saved in Storage and retained for retries.
    </v-alert>
    <v-alert
      v-if="message"
      :type="message.type"
      :text="message.text"
      closable
      class="mb-4"
      @click:close="message = undefined"
    />

    <form @submit.prevent="send">
      <v-text-field
        v-model="address"
        label="Recipient email"
        type="email"
        required
        maxlength="240"
        :disabled="!!busy || !enabled"
      />
      <v-text-field
        v-model="name"
        label="Recipient name (optional)"
        maxlength="240"
        :disabled="!!busy || !enabled"
      />
      <v-text-field
        v-model="subject"
        label="Subject"
        required
        maxlength="240"
        :disabled="!!busy || !enabled"
      />
      <v-textarea
        v-model="content"
        label="HTML content"
        required
        rows="6"
        :disabled="!!busy || !enabled"
      />
      <v-select
        v-model="priority"
        label="Priority"
        :items="priorities"
        :disabled="!!busy || !enabled"
      />
      <v-file-input
        v-model="file"
        label="Attachment (optional, up to 10 MiB)"
        show-size
        :error-messages="fileError"
        :disabled="!!busy || !enabled"
      />
      <v-btn
        type="submit"
        color="primary"
        prepend-icon="$mdiEmail"
        :loading="busy === 'send'"
        :disabled="!canSend"
        >Send email</v-btn
      >
    </form>

    <div class="d-flex align-center justify-space-between mt-8 mb-3">
      <h4>Delivery history</h4>
      <v-btn
        icon="$mdiRefresh"
        variant="text"
        aria-label="Refresh emails"
        :loading="busy === 'list'"
        :disabled="!!busy || !enabled"
        @click="list()"
      />
    </div>
    <v-table>
      <thead>
        <tr>
          <th>Subject / ID</th>
          <th>Status</th>
          <th>Attempts</th>
          <th>Created / Delivered</th>
          <th>Error / Retry after</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>
            {{ item.subject }}
            <div class="text-caption">{{ item.id }}</div>
          </td>
          <td>
            <v-chip
              :color="item.status === 'S' ? 'success' : item.status === 'E' ? 'error' : 'warning'"
            >
              {{ item.status === 'S' ? 'Sent' : item.status === 'E' ? 'Error' : 'Queued' }}
            </v-chip>
          </td>
          <td>{{ item.attempts }}</td>
          <td>
            {{ formatDate(item.created) }}
            <div>{{ formatDate(item.delivered) }}</div>
          </td>
          <td class="email-error">
            {{ item.error }}
            <div v-if="item.postponed">{{ formatDate(item.postponed) }}</div>
          </td>
          <td>
            <v-btn
              v-if="item.status !== 'S'"
              size="small"
              :loading="busy === `retry:${item.id}`"
              :disabled="!!busy || !enabled"
              @click="retry(item.id)"
              >Retry</v-btn
            >
          </td>
        </tr>
        <tr v-if="!items.length">
          <td colspan="6" class="text-medium-emphasis py-5">
            {{ enabled ? 'No emails.' : 'Sign in as an administrator to access emails.' }}
          </td>
        </tr>
      </tbody>
    </v-table>
    <v-btn v-if="nextCursor" class="mt-3" :disabled="!!busy || !enabled" @click="list(nextCursor)">
      Next
    </v-btn>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuth } from '@/capabilities/auth'
import { useHttp } from '@/capabilities/http'
import type { components } from '@/api/openapi.generated'

definePage({
  meta: {
    title: 'Emails',
    icon: '$mdiEmail',
    access: ['admin'],
    navigation: true,
  },
})

type EmailItem = components['schemas']['SandboxListEmailsItemsItem']

const auth = useAuth()
const http = useHttp()
const enabled = computed(() => auth.authenticated.value && auth.hasRole('admin'))
const address = ref('')
const name = ref('')
const subject = ref('')
const content = ref('')
const priority = ref(3)
const file = ref<File>()
const attachmentId = ref<string>()
const items = ref<EmailItem[]>([])
const nextCursor = ref<string>()
const busy = ref<string>()
const message = ref<{ type: 'success' | 'error'; text: string }>()
const priorities = [
  { title: '1 - Highest', value: 1 },
  { title: '2 - High', value: 2 },
  { title: '3 - Normal', value: 3 },
  { title: '4 - Low', value: 4 },
  { title: '5 - Lowest', value: 5 },
]
const fileError = computed(() =>
  file.value && file.value.size > 10 * 1024 * 1024 ? 'Maximum attachment size is 10 MiB.' : '',
)
const canSend = computed(
  () =>
    enabled.value &&
    !busy.value &&
    !fileError.value &&
    !!address.value.trim() &&
    !!subject.value.trim() &&
    !!content.value.trim(),
)

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : ''

async function load(cursor?: string) {
  const query = new URLSearchParams({ limit: '51' })
  if (cursor) query.set('cursor', cursor)
  const response = await http.get<components['schemas']['SandboxListEmailsResponse']>(
    `/sandbox/emails?${query}`,
  )
  if (response.error || !response.data)
    throw response.error ?? new Error('Emails could not be loaded.')
  items.value = response.data.items.slice(0, 50)
  nextCursor.value = response.data.items.length > 50 ? items.value.at(-1)?.id : undefined
}

async function run(action: string, call: () => Promise<void>) {
  if (busy.value || !enabled.value) return
  busy.value = action
  message.value = undefined
  try {
    await call()
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'The email request failed.',
    }
  } finally {
    busy.value = undefined
  }
}

const list = (cursor?: string) => run('list', () => load(cursor))

async function refreshHistory(outcome: string) {
  try {
    await load()
  } catch (error) {
    throw new Error(
      `${outcome} History refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

async function send() {
  if (!canSend.value) return
  await run('send', async () => {
    if (file.value && !attachmentId.value) {
      const upload = await http.upload<components['schemas']['SandboxUploadStorageResponse']>(
        '/sandbox/storage',
        file.value,
      )
      if (upload.error || !upload.data?.id) {
        throw upload.error ?? new Error('Attachment could not be uploaded.')
      }
      attachmentId.value = upload.data.id
    }
    const response = await http.post<components['schemas']['SandboxSendEmailResponse']>(
      '/sandbox/emails',
      {
        address: address.value.trim(),
        name: name.value.trim() || null,
        subject: subject.value.trim(),
        content: content.value,
        priority: priority.value,
        attachmentId: attachmentId.value ?? null,
      },
    )
    if (response.error || !response.data?.id) {
      const failure = response.error ?? new Error('Email could not be sent.')
      const outcome = `${failure.message} Check delivery history and use Retry for a queued message.`
      await refreshHistory(outcome)
      throw new Error(outcome)
    }
    message.value = {
      type: 'success',
      text: `Email ${response.data.id} accepted by the SMTP server.`,
    }
    file.value = undefined
    attachmentId.value = undefined
    await refreshHistory(message.value.text)
  })
}

const retry = (id: string) =>
  run(`retry:${id}`, async () => {
    const response = await http.post(`/sandbox/emails/${encodeURIComponent(id)}/send`)
    if (response.error) {
      await refreshHistory(response.error.message)
      throw response.error
    }
    message.value = { type: 'success', text: `Email ${id} accepted by the SMTP server.` }
    await refreshHistory(message.value.text)
  })

watch(file, () => {
  attachmentId.value = undefined
})
watch(
  enabled,
  (allowed) => {
    items.value = []
    nextCursor.value = undefined
    attachmentId.value = undefined
    if (allowed) void list()
  },
  { immediate: true },
)
</script>

<style scoped>
.email-error {
  max-width: 360px;
  overflow-wrap: anywhere;
}
</style>
