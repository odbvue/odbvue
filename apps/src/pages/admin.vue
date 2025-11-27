<template>
  <v-container>
    <h1>Admin</h1>
    <h2>Audit</h2>
    <v-ov-table :options :data :t :loading @fetch="fetchAudit"></v-ov-table>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Admin',
    description: 'Administration page',
    icon: '$mdiShieldAccount',
    color: '#FFDDDD',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const http = useHttp()
const { t } = useI18n()

const loading = ref(false)
const data = ref<OvTableData[]>([])
const options = ref<OvTableOptions>({
  key: 'audit',
  columns: [
    { name: 'created' },
    {
      name: 'severity',
      format: [
        { rules: { type: 'contains', params: 'ERROR' }, color: 'error', icon: '$mdiAlertCircle' },
        { rules: { type: 'contains', params: 'WARN' }, color: 'warning', icon: '$mdiAlert' },
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
        type: 'text',
        name: 'message',
        label: 'message',
      },
    ],
    actions: [{ name: 'apply' }, { name: 'cancel' }],
    actionSubmit: 'apply',
    actionCancel: 'cancel',
    cols: 2,
  },
  maxLength: 30,
})

type Audit = {
  id: string
  created: string
  severity: string
  module: string
  message: string
  attributes: string
}

type AuditResponse = {
  audit: Audit[]
}

const fetchAudit = async (
  fetchData: OvTableData[],
  offset: number,
  limit: number,
  search: string,
  filter: OvFilterValue,
  sort: string,
) => {
  loading.value = true
  const { data: auditData } = await http.get<AuditResponse>('adm/audit/', {
    params: {
      offset,
      limit,
      search,
      filter: encodeURIComponent(JSON.stringify(filter)),
      sort,
    },
  })
  data.value = auditData?.audit ?? []
  loading.value = false
}
</script>
