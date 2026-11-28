<template>
  <v-ov-table
    :options="options"
    :title="userId === undefined ? 'admin.audit' : undefined"
    @fetch="fetchAudit"
  />
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvFormSelectionField, OvTableFetchRequest, OvTableOptions } from '@/components/api'

const props = defineProps<{ userId?: string; stateKey?: string }>()

const http = useHttp()
const ui = useUi()
const { t } = useI18n()
const userItems = shallowRef(new Map<string, { title: string; value: string }>())

const userFilter: OvFormSelectionField = {
  type: 'autocomplete',
  name: 'userId',
  label: 'admin.searchUsers',
  clearable: true,
  minSearchLength: 1,
  async fetchItems(search) {
    const result = await ui.action('admin.audit.users', async () => {
      const { data, error } = await http.get<components['schemas']['AdminListUsersResponse']>(
        '/admin/users',
        { query: { search: search.trim(), limit: 25 } },
      )
      if (error || !data) throw new Error('admin.loadUsersError')
      return data.items.map(({ id, username, displayName }) => ({
        title: displayName && displayName !== username ? `${displayName} (${username})` : username,
        value: id,
      }))
    })
    if (!result.ok || !result.data) return []
    userItems.value = new Map([
      ...userItems.value,
      ...result.data.map((item) => [item.value, item] as const),
    ])
    return result.data
  },
}

const options = computed<OvTableOptions>(() => ({
  key: 'id',
  stateKey: props.stateKey ?? (props.userId ? `admin.users.${props.userId}.audit` : 'admin.audit'),
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
    ...(props.userId === undefined
      ? [
          { name: 'username', label: 'admin.username' },
          { name: 'displayName', label: 'admin.displayName' },
        ]
      : []),
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
      ...(props.userId === undefined
        ? [{ ...userFilter, items: [...userItems.value.values()] }]
        : []),
    ],
    actions: [{ name: 'admin.apply' }, { name: 'admin.cancel', format: { variant: 'outlined' } }],
    actionSubmit: 'admin.apply',
    actionCancel: 'admin.cancel',
    cols: 2,
  },
}))

async function fetchAudit({ cursor, limit, filter, signal, complete }: OvTableFetchRequest) {
  if (signal.aborted) return complete()
  const result = await ui.action(
    props.userId === undefined ? 'admin.audit.list' : 'admin.users.audit.list',
    async () => {
      const query = {
        cursor,
        limit,
        severity: filter?.severity?.filter(Boolean).join(',') || undefined,
        messageType: filter?.messageType?.[0] || undefined,
        from: filter?.from?.[0],
        to: filter?.to?.[0],
      }

      if (props.userId !== undefined) {
        const { data, error } = await http.get<components['schemas']['AdminListUserAuditResponse']>(
          `/admin/users/${encodeURIComponent(props.userId)}/audit`,
          { query, signal },
        )
        if (signal.aborted) return
        if (error || !data) throw new Error('admin.loadAuditError')
        return data
      }

      const { data, error } = await http.get<components['schemas']['AdminListAuditResponse']>(
        '/admin/audit/events',
        {
          query: { ...query, userId: filter?.userId?.[0] || undefined },
          signal,
        },
      )
      if (signal.aborted) return
      if (error || !data) throw new Error('admin.loadAuditError')
      return data
    },
  )
  if (signal.aborted || !result.ok || !result.data) return complete()
  complete(result.data)
}
</script>
