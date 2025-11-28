<template>
  <v-ov-table :options :data :t :loading @fetch="fetchAudit"></v-ov-table>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const { t } = useI18n()

type AuditResponse = {
  audit: Array<{
    id: string
    created: string
    severity: string
    module: string
    message: string
    attributes: string
  }>
}

const {
  loading,
  data,
  fetch: fetchAudit,
} = useTableFetch<AuditResponse>({
  endpoint: 'adm/audit/',
  responseKey: 'audit',
})

const options = ref<OvTableOptions>({
  key: 'audit',
  columns: [
    { name: 'created' },
    {
      name: 'severity',
      format: [
        { rules: { type: 'contains', params: 'ERROR' }, color: 'error', icon: '$mdiAlertCircle' },
        { rules: { type: 'contains', params: 'WARN' }, color: 'warning', icon: '$mdiAlert' },
        { rules: { type: 'contains', params: 'INFO' }, color: 'info', icon: '$mdiInformation' },
      ],
    },
    { name: 'module' },
    { name: 'username' },
    { name: 'message' },
    { name: 'attributes', maxLength: 0 },
  ],
  filter: {
    fields: [
      {
        type: 'select',
        name: 'severity',
        label: 'severity',
        items: ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'],
        multiple: true,
      },
      {
        type: 'text',
        name: 'username',
        label: 'username',
      },
      {
        type: 'text',
        name: 'module',
        label: 'module',
      },
      {
        type: 'datetime',
        name: 'period_from',
        label: 'period.from',
      },
      {
        type: 'datetime',
        name: 'period_to',
        label: 'period.to',
      },
    ],
    actions: [{ name: 'apply' }, { name: 'cancel', format: { variant: 'outlined' } }],
    actionSubmit: 'apply',
    actionCancel: 'cancel',
    cols: 2,
  },
  maxLength: 30,
})
</script>
