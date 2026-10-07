<template>
  <v-container class="storage-page">
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-5">
      <h3>Storage</h3>
      <v-chip
        :color="auth.authenticated.value ? 'success' : 'warning'"
        prepend-icon="$mdiShieldLock"
      >
        {{ auth.authenticated.value ? 'My files' : 'Authentication required' }}
      </v-chip>
    </div>

    <v-alert
      v-if="message"
      :type="message.type"
      :text="message.text"
      closable
      class="mb-4"
      @click:close="message = undefined"
    />

    <form class="d-flex align-start flex-wrap ga-3 mb-6" @submit.prevent="upload">
      <v-file-input
        v-model="file"
        label="File"
        show-size
        hide-details="auto"
        class="file-input"
        :disabled="!!busy || !auth.authenticated.value"
        :error-messages="fileError"
      />
      <v-btn
        type="submit"
        color="primary"
        prepend-icon="$mdiUpload"
        :loading="busy === 'upload'"
        :disabled="!file || !!fileError || !!busy || !auth.authenticated.value"
        >Upload</v-btn
      >
    </form>

    <div class="d-flex align-center justify-space-between mb-2">
      <h4>Files</h4>
      <v-tooltip text="Refresh files">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            icon="$mdiRefresh"
            variant="text"
            aria-label="Refresh files"
            :loading="busy === 'list'"
            :disabled="!!busy || !auth.authenticated.value"
            @click="list()"
          />
        </template>
      </v-tooltip>
    </div>
    <v-table density="comfortable">
      <thead>
        <tr>
          <th>Filename</th>
          <th>Type</th>
          <th>Size</th>
          <th>Uploaded</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td class="file-name">{{ item.fileName }}</td>
          <td>{{ item.mimeType }}</td>
          <td class="text-no-wrap">{{ formatBytes(item.fileSize) }}</td>
          <td class="text-no-wrap">{{ formatDate(item.createdAt) }}</td>
          <td class="text-right text-no-wrap">
            <v-tooltip text="Download file">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="$mdiDownload"
                  size="small"
                  variant="text"
                  aria-label="Download file"
                  :loading="busy === `download:${item.id}`"
                  :disabled="!!busy || !auth.authenticated.value"
                  @click="download(item)"
                />
              </template>
            </v-tooltip>
            <v-tooltip text="Delete file">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="$mdiDelete"
                  color="error"
                  size="small"
                  variant="text"
                  aria-label="Delete file"
                  :disabled="!!busy || !auth.authenticated.value"
                  @click="pendingDelete = item"
                />
              </template>
            </v-tooltip>
          </td>
        </tr>
        <tr v-if="!items.length">
          <td colspan="5" class="text-medium-emphasis py-6">
            {{
              busy === 'list'
                ? 'Loading files...'
                : auth.authenticated.value
                  ? 'No files.'
                  : 'Sign in to access your files.'
            }}
          </td>
        </tr>
      </tbody>
    </v-table>
    <div class="d-flex justify-end mt-3">
      <v-btn
        v-if="nextCursor"
        prepend-icon="$mdiChevronRight"
        :disabled="!!busy || !auth.authenticated.value"
        @click="list(nextCursor)"
        >Next</v-btn
      >
    </div>

    <v-dialog
      :model-value="!!pendingDelete"
      max-width="440"
      :persistent="busy === 'remove'"
      @update:model-value="
        (open) => {
          if (!open) pendingDelete = undefined
        }
      "
    >
      <v-card title="Delete file?">
        <v-card-text class="file-name">{{ pendingDelete?.fileName }}</v-card-text>
        <v-card-actions>
          <v-btn :disabled="busy === 'remove'" @click="pendingDelete = undefined">Cancel</v-btn>
          <v-btn
            color="error"
            prepend-icon="$mdiDelete"
            :loading="busy === 'remove'"
            @click="remove"
            >Delete</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { httpContract, useAuth, useOdbVue } from '@odbvue/web'
import { computed, ref, watch } from 'vue'
import type { components } from '@/services/openapi.generated'

definePage({
  meta: {
    title: 'Storage',
    icon: '$mdiFolder',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

type Item = components['schemas']['SandboxListStorageItemsItem']
type StoredFileResponse = {
  id: string
  file_name: string
  mime_type: string
  file_size: number
  meta: unknown
  created_at: string
}
const maxFileBytes = 10 * 1024 * 1024
const pageSize = 50
const auth = useAuth()
const http = useOdbVue().get(httpContract)
const file = ref<File>()
const items = ref<Item[]>([])
const nextCursor = ref<string>()
const busy = ref<string>()
const pendingDelete = ref<Item>()
const message = ref<{ type: 'success' | 'error'; text: string }>()
const fileError = computed(() =>
  file.value && file.value.size > maxFileBytes ? 'Maximum file size is 10 MiB.' : '',
)

async function run(action: string, call: () => Promise<void>) {
  if (busy.value || !auth.authenticated.value) return
  busy.value = action
  message.value = undefined
  try {
    await call()
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'The storage request failed.',
    }
  } finally {
    busy.value = undefined
  }
}

async function load(cursor?: string) {
  const query = new URLSearchParams({ limit: String(pageSize + 1) })
  if (cursor) query.set('cursor', cursor)
  const response = await http.get<{ items: StoredFileResponse[] }>(`/sandbox/storage?${query}`)
  if (response.error || !response.data) throw new Error('Files could not be loaded.')
  items.value = response.data.items.slice(0, pageSize).map((item) => ({
    id: item.id,
    fileName: item.file_name,
    mimeType: item.mime_type,
    fileSize: item.file_size,
    meta: item.meta,
    createdAt: item.created_at,
  }))
  nextCursor.value = response.data.items.length > pageSize ? items.value.at(-1)?.id : undefined
}

const list = (cursor?: string) => run('list', () => load(cursor))

const upload = () =>
  run('upload', async () => {
    const selected = file.value
    if (!selected || fileError.value) return
    const response = await http.upload<components['schemas']['SandboxUploadStorageResponse']>(
      '/sandbox/storage',
      selected,
      { meta: {} },
    )
    if (response.error || !response.data?.id) throw new Error('File could not be uploaded.')
    file.value = undefined
    message.value = { type: 'success', text: `${selected.name} uploaded.` }
    await load()
  })

const download = (item: Item) =>
  run(`download:${item.id}`, async () => {
    await http.download(`/sandbox/storage/${encodeURIComponent(item.id)}`, item.fileName, {
      expectedSize: Number(item.fileSize),
    })
    message.value = { type: 'success', text: `${item.fileName} downloaded.` }
  })

const remove = () =>
  run('remove', async () => {
    const item = pendingDelete.value
    if (!item) return
    const response = await http.delete(`/sandbox/storage/${encodeURIComponent(item.id)}`)
    if (response.error) throw new Error('File could not be deleted.')
    pendingDelete.value = undefined
    items.value = items.value.filter((stored) => stored.id !== item.id)
    message.value = { type: 'success', text: `${item.fileName} deleted.` }
  })

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

watch(
  auth.authenticated,
  (authenticated) => {
    items.value = []
    nextCursor.value = undefined
    pendingDelete.value = undefined
    file.value = undefined
    message.value = undefined
    if (authenticated) void list()
  },
  { immediate: true },
)
</script>

<style scoped>
.file-input {
  flex: 1 1 280px;
  min-width: 0;
}
.file-name {
  overflow-wrap: anywhere;
  max-width: 320px;
}
</style>
