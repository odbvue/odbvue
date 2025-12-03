<template>
  <v-container>
    <v-tabs v-model="admin.tab">
      <v-tab value="details">{{ t('details') }}</v-tab>
      <v-tab value="permissions">{{ t('permissions') }}</v-tab>
      <v-tab value="audit">{{ t('audit') }}</v-tab>
      <v-tab value="emails">{{ t('emails') }}</v-tab>
    </v-tabs>
    <br />
    <v-tabs-window v-model="admin.tab">
      <v-tabs-window-item value="details">
        <v-ov-table
          :data="detailsData"
          :options="detailsOptions"
          :loading="detailsLoading"
          @fetch="detailsFetch"
        />
      </v-tabs-window-item>
      <v-tabs-window-item value="permissions">
        <v-ov-table
          :data="permData"
          :options="permOptions"
          :loading="permLoading"
          @fetch="permFetch"
          @action="permAction"
        />
      </v-tabs-window-item>
      <v-tabs-window-item value="audit">
        <v-ov-table
          :data="auditData"
          :options="auditOptions"
          :loading="auditLoading"
          @fetch="auditFetch"
        />
      </v-tabs-window-item>
      <v-tabs-window-item value="emails">
        <v-ov-table
          :data="emailsData"
          :options="emailsOptions"
          :loading="emailsLoading"
          @fetch="emailsFetch"
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

const { t } = useI18n()

const admin = useAdminStore()

const route = useRoute()
const uuid =
  'uuid' in route.params
    ? Array.isArray(route.params.uuid)
      ? route.params.uuid[0]
      : route.params.uuid
    : ''

// details

const {
  data: detailsData,
  loading: detailsLoading,
  fetch: detailsFetch,
} = useTableFetch({
  endpoint: 'adm/users/',
  responseKey: 'users',
  search: uuid,
})

watch(detailsData, (newVal) => {
  if (newVal && newVal.length > 0) {
    useNavigationStore().breadcrumb = newVal[0]?.username as string
  }
})

onUnmounted(() => {
  useNavigationStore().breadcrumb = ''
})

const detailsOptions = <OvTableOptions>{
  key: 'uuid',
  columns: [
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
  maxLength: 24,
  canRefresh: false,
  alwaysMobile: true,
}

// permissions

const roles = ref<string[]>([])

interface RolesResponse {
  roles: { role: string }[]
}

onMounted(async () => {
  const { data } = await useHttp().get<RolesResponse>('adm/roles/', {
    params: { offset: 0, limit: 100 },
  })
  roles.value = data?.roles ? data.roles.map((r) => r.role) : []
})

const {
  data: permData,
  loading: permLoading,
  fetch: permFetch,
} = useTableFetch({
  endpoint: 'adm/permissions/',
  responseKey: 'permissions',
  filter: { uuid: [uuid] },
})

const { action: permAction } = useFormAction({
  endpoints: {
    edit: 'adm/permission/',
    add: 'adm/permission/',
  },
  refetchOn: ['add'],
  transformPayload: (actionName, payload) => {
    payload['uuid'] = uuid
    return payload
  },
})

const permOptions = computed<OvTableOptions>(() => ({
  key: 'id',
  columns: [
    { name: 'role' },
    { name: 'permission' },
    { name: 'from' },
    { name: 'to' },
    {
      name: 'actions',
      actions: [
        {
          name: 'edit',
          key: 'id',
          format: { icon: '$mdiPencil' },
          form: {
            cols: 2,
            fields: [
              {
                name: 'role',
                label: 'role',
                type: 'autocomplete',
                items: roles.value,
              },
              {
                name: 'permission',
                label: 'permission',
                type: 'text',
              },
              {
                name: 'from',
                label: 'from',
                type: 'datetime',
                clearable: true,
              },
              {
                name: 'to',
                label: 'to',
                type: 'datetime',
                clearable: true,
              },
            ],
            actions: [{ name: 'submit' }, { name: 'cancel', format: { variant: 'outlined' } }],
            actionSubmit: 'submit',
            actionCancel: 'cancel',
          },
        },
      ],
    },
  ],
  actions: [
    {
      name: 'add',
      format: {
        icon: '$mdiPlus',
      },
      form: {
        cols: 2,
        fields: [
          {
            name: 'role',
            label: 'role',
            type: 'autocomplete',
            items: roles.value,
          },
          {
            name: 'permission',
            label: 'permission',
            type: 'text',
            value: 'Y',
          },
          {
            name: 'from',
            label: 'from',
            type: 'datetime',
            value: new Date().toISOString().slice(0, 16),
          },
          {
            name: 'to',
            label: 'to',
            type: 'datetime',
          },
        ],
        actions: [{ name: 'submit' }, { name: 'cancel', format: { variant: 'outlined' } }],
        actionSubmit: 'submit',
        actionCancel: 'cancel',
      },
    },
  ],
  maxLength: 24,
}))

// audit

const {
  data: auditData,
  loading: auditLoading,
  fetch: auditFetch,
} = useTableFetch({
  endpoint: 'adm/audit/',
  responseKey: 'audit',
  filter: { uuid: [uuid] },
})

const auditOptions = ref<OvTableOptions>({
  key: 'id',
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
  maxLength: 24,
})

// emails

const {
  loading: emailsLoading,
  data: emailsData,
  fetch: emailsFetch,
} = useTableFetch({
  endpoint: 'adm/emails/',
  responseKey: 'emails',
  filter: { uuid: [uuid] },
})

const emailsOptions = ref<OvTableOptions>({
  key: 'id',
  columns: [
    { name: 'created' },
    { name: 'to' },
    { name: 'subject' },
    { name: 'content', maxLength: 0, format: { html: true } },
    {
      name: 'status',
      format: [
        { rules: { type: 'contains', params: 'ERROR' }, color: 'error', icon: '$mdiAlertCircle' },
        { rules: { type: 'contains', params: 'SENT' }, color: 'success', icon: '$mdiCheck' },
        { rules: { type: 'contains', params: 'PENDING' }, color: 'info', icon: '$mdiInformation' },
      ],
    },
    { name: 'error', maxLength: 0 },
  ],
  maxLength: 30,
})
</script>
