<template>
  <v-container>
    <v-ov-table
      :options="options"
      title="admin.emails"
      description="admin.emailsDescription"
      @fetch="fetchEmails"
      @action="onAction"
    />
    <v-ov-dialog
      v-model="detailsOpen"
      :title="email?.subject || t('admin.emailDetails')"
      :closeable="true"
      scrollable
    >
      <template #content>
        <template v-if="email">
          <p class="mb-3">{{ t('admin.emailPreviewNotice') }}</p>
          <iframe
            class="email-preview"
            :title="t('admin.emailBody')"
            :srcdoc="preview"
            sandbox=""
            referrerpolicy="no-referrer"
          />
        </template>
        <v-progress-linear
          v-else-if="loadingDetails"
          indeterminate
          :aria-label="t('admin.emailDetails')"
        />
        <v-alert v-else-if="detailsError" type="error" :text="t(detailsError)" />
      </template>
    </v-ov-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvTableFetchRequest, OvTableOptions } from '@/components/api'
import { emailPreviewDocument } from '../../components/emailPreview'

definePage({
  meta: {
    title: 'admin.emails',
    icon: '$mdiEmail',
    access: ['admin'],
    navigation: true,
  },
})

const http = useHttp()
const ui = useUi()
const { t } = useI18n()
const detailsOpen = ref(false)
const selectedId = ref<string>()
const email = ref<components['schemas']['AdminGetEmailItemsItem']>()
const preview = computed(() => emailPreviewDocument(email.value?.content ?? ''))
const loadingDetails = ref(false)
const detailsError = ref<string>()

function onAction(action: string, _values: unknown, row?: unknown) {
  if (action !== 'admin.details') return
  if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' || !row.id)
    return ui.error('admin.loadEmailError')
  selectedId.value = row.id
  detailsOpen.value = true
}

watch(
  () => (detailsOpen.value ? selectedId.value : undefined),
  async (id, _old, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    email.value = undefined
    detailsError.value = undefined
    loadingDetails.value = !!id
    if (!id) return
    try {
      const { data, error, status } = await http.get<
        components['schemas']['AdminGetEmailResponse']
      >(`/admin/emails/${encodeURIComponent(id)}`, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (error || !data)
        throw new Error(status === 404 ? 'admin.emailNotFound' : 'admin.loadEmailError')
      if (!data.items[0]) throw new Error('admin.emailNotFound')
      email.value = data.items[0]
    } catch (error) {
      if (controller.signal.aborted) return
      detailsError.value =
        error instanceof Error && error.message === 'admin.emailNotFound'
          ? 'admin.emailNotFound'
          : 'admin.loadEmailError'
    } finally {
      if (!controller.signal.aborted) loadingDetails.value = false
    }
  },
)
const options = computed<OvTableOptions>(() => ({
  key: 'id',
  stateKey: 'admin.emails',
  search: { placeholder: t('admin.searchEmails') },
  columns: [
    { name: 'created', label: 'admin.createdAt', format: { tsFormat: 'datetime' } },
    { name: 'toRecipients', label: 'admin.emailTo', maxLength: 40 },
    { name: 'ccRecipients', label: 'admin.emailCc', maxLength: 40 },
    { name: 'bccRecipients', label: 'admin.emailBcc', maxLength: 40 },
    { name: 'subject', label: 'admin.emailSubject' },
    {
      name: 'status',
      label: 'admin.status',
      format: [
        {
          rules: { type: 'equals', params: 'S' },
          text: t('admin.emailSent'),
          color: 'success',
          icon: '$mdiCheckCircle',
        },
        {
          rules: { type: 'equals', params: 'E' },
          text: t('admin.emailFailed'),
          color: 'error',
          icon: '$mdiAlertCircle',
        },
        {
          rules: { type: 'equals', params: 'N' },
          text: t('admin.emailQueued'),
          color: 'warning',
          icon: '$mdiClockOutline',
        },
      ],
    },
    { name: 'attempts', label: 'admin.emailAttempts' },
    { name: 'error', label: 'admin.emailError' },
    {
      name: 'actions',
      label: 'admin.details',
      actions: [
        {
          name: 'admin.details',
          title: 'admin.details',
          key: 'id',
          format: { icon: '$mdiMagnify' },
        },
      ],
    },
  ],
  filter: {
    fields: [
      { type: 'text', name: 'address', label: 'admin.emailAddress' },
      {
        type: 'datetime',
        name: 'from',
        label: 'admin.emailCreatedFrom',
        filterUtc: true,
        rules: [{ type: 'date', params: undefined, message: 'admin.emailInvalidInterval' }],
      },
      {
        type: 'datetime',
        name: 'to',
        label: 'admin.emailCreatedTo',
        filterUtc: true,
        rules: [
          { type: 'date', params: undefined, message: 'admin.emailInvalidInterval' },
          { type: 'date-on-or-after', params: 'from', message: 'admin.emailInvalidInterval' },
        ],
      },
    ],
    actions: [{ name: 'admin.apply' }, { name: 'admin.cancel', format: { variant: 'outlined' } }],
    actionSubmit: 'admin.apply',
    actionCancel: 'admin.cancel',
    cols: 2,
  },
}))

async function fetchEmails({
  cursor,
  limit,
  search,
  filter,
  signal,
  complete,
}: OvTableFetchRequest) {
  if (signal.aborted) return complete()
  const result = await ui.action('admin.emails.list', async () => {
    const { data, error } = await http.get<components['schemas']['AdminListEmailsResponse']>(
      '/admin/emails',
      {
        query: {
          cursor,
          limit,
          search,
          address: filter?.address?.[0]?.trim() || undefined,
          from: filter?.from?.[0],
          to: filter?.to?.[0],
        },
        signal,
      },
    )
    if (signal.aborted) return
    if (error || !data) throw new Error('admin.loadEmailsError')
    return data
  })
  if (signal.aborted || !result.ok || !result.data) return complete()
  complete(result.data)
}
</script>

<style scoped>
.email-preview {
  width: 100%;
  height: 18rem;
  border: 1px solid rgb(var(--v-theme-on-surface), 0.2);
  background: white;
}
</style>
