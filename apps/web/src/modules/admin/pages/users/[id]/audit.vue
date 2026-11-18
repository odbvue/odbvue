<template>
  <v-ov-table :key="user.id" :options="options" @fetch="fetchAudit" />
</template>

<script setup lang="ts">
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvTableFetchRequest, OvTableOptions } from '@/components/api'

definePage({
  meta: {
    title: 'admin.audit',
    access: ['admin'],
    navigation: false,
  },
})

const props = defineProps<{
  user: components['schemas']['AdminGetUserItemsItem']
  isSelf: boolean
}>()
const http = useHttp()
const ui = useUi()
const { t } = useI18n()

const options = computed<OvTableOptions>(() => ({
  key: 'id',
  columns: [
    {
      name: 'severityText',
      label: 'admin.auditSeverity',
      format: [
        { rules: { type: 'equals', params: 'ERROR' }, color: 'error', icon: '$mdiAlertCircle' },
        { rules: { type: 'equals', params: 'WARN' }, color: 'warning', icon: '$mdiAlert' },
        { rules: { type: 'equals', params: 'INFO' }, color: 'info', icon: '$mdiInformation' },
      ],
    },
    { name: 'eventTimestamp', label: 'admin.auditTime', format: { tsFormat: 'datetime' } },
    { name: 'body', label: 'admin.auditMessage' },
    { name: 'attributes', label: 'admin.auditAttributes', maxLength: 0 },
  ],
  filter: {
    fields: [
      {
        type: 'select',
        name: 'severity',
        label: 'admin.auditSeverity',
        items: [
          { title: t('admin.auditError'), value: 'ERROR' },
          { title: t('admin.auditWarn'), value: 'WARN' },
          { title: t('admin.auditInfo'), value: 'INFO' },
        ],
        multiple: true,
        clearable: true,
      },
      { type: 'text', name: 'messageType', label: 'admin.auditMessageType' },
      {
        type: 'datetime',
        name: 'from',
        label: 'admin.auditFrom',
        filterUtc: true,
        rules: [{ type: 'date', params: undefined, message: 'admin.auditInvalidInterval' }],
      },
      {
        type: 'datetime',
        name: 'to',
        label: 'admin.auditTo',
        filterUtc: true,
        rules: [
          { type: 'date', params: undefined, message: 'admin.auditInvalidInterval' },
          { type: 'date-on-or-after', params: 'from', message: 'admin.auditInvalidInterval' },
        ],
      },
    ],
    actions: [{ name: 'admin.apply' }, { name: 'admin.cancel', format: { variant: 'outlined' } }],
    actionSubmit: 'admin.apply',
    actionCancel: 'admin.cancel',
    cols: 2,
  },
}))

async function fetchAudit({ cursor, limit, filter, signal, complete }: OvTableFetchRequest) {
  if (signal.aborted) return complete()
  const result = await ui.action('admin.users.audit.list', async () => {
    const { data, error } = await http.get<components['schemas']['AdminListUserAuditResponse']>(
      `/admin/users/${encodeURIComponent(props.user.id)}/audit`,
      {
        query: {
          cursor,
          limit,
          severity: filter?.severity?.filter(Boolean).join(',') || undefined,
          messageType: filter?.messageType?.[0] || undefined,
          from: filter?.from?.[0],
          to: filter?.to?.[0],
        },
        signal,
      },
    )
    if (signal.aborted) return
    if (error || !data) throw new Error('admin.loadAuditError')
    return data
  })
  if (signal.aborted || !result.ok || !result.data) return complete()
  complete(result.data)
}
</script>
