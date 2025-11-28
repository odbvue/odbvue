<template>
  <v-container>
    <label>{{ userData.username }}</label>
    <br />
    <br />
    <v-tabs v-model="tab">
      <v-tab value="details">{{ t('details') }}</v-tab>
      <v-tab value="audit">{{ t('audit') }}</v-tab>
    </v-tabs>
    <br />
    <v-tabs-window v-model="tab">
      <v-tabs-window-item value="details">
        <v-ov-view :data="userData" :options="userOptions"></v-ov-view>
      </v-tabs-window-item>
      <v-tabs-window-item value="audit">
        <v-ov-table
          :options="auditOptions"
          :data="auditData"
          :t
          :loading="auditLoading"
          @fetch="auditFetch"
        />
      </v-tabs-window-item>
    </v-tabs-window>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Details',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const http = useHttp()
const { t } = useI18n()

const route = useRoute()
const uuid =
  'uuid' in route.params
    ? Array.isArray(route.params.uuid)
      ? route.params.uuid[0]
      : route.params.uuid
    : ''

const tab = ref('details')

// user

type UserResponse = {
  users: Array<{
    id: string
    username: string
    fullname: string
    created: string
    accessed: string
    status_text: string
  }>
}

const userData = ref<{
  id: string
  username: string
  fullname: string
  created: string
  accessed: string
  status_text: string
}>({
  id: '',
  username: '',
  fullname: '',
  created: '',
  accessed: '',
  status_text: '',
})

const userOptions = ref({
  key: 'uuid',
  items: [
    { name: 'username', label: 'username' },
    { name: 'fullname', label: 'full.name' },
    { name: 'created', label: 'created' },
    { name: 'accessed', label: 'accessed' },
    {
      name: 'status_text',
      label: 'status',
      format: [
        {
          rules: { type: 'contains', params: 'Unverified' },
          color: 'warning',
          icon: '$mdiAlertCircle',
        },
        { rules: { type: 'contains', params: 'Disabled' }, color: 'error', icon: '$mdiAlert' },
        {
          rules: { type: 'contains', params: 'Verified' },
          color: 'success',
          icon: '$mdiInformation',
        },
      ],
    },
  ],
})

onMounted(async () => {
  const { data } = await http.get<UserResponse>('adm/users/', {
    params: { offset: 0, limit: 1, search: uuid },
  })

  if (data?.users[0]) {
    userData.value = data.users[0]
  }
})

// audit

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
  loading: auditLoading,
  data: auditData,
  fetch: auditFetch,
} = useTableFetch<AuditResponse>({
  endpoint: 'adm/audit/',
  responseKey: 'audit',
  filter: { uuid: [uuid] },
})

const auditOptions = ref<OvTableOptions>({
  key: 'id',
  itemsPerPage: 5,
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
})
</script>
