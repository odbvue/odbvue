<template>
  <v-ov-table
    :options="options"
    :data="data"
    :loading="loading"
    @fetch="fetch"
    @action="action"
  ></v-ov-table>
</template>
<script setup lang="ts">
definePage({
  meta: {
    title: 'Roles',
    description: 'Manage user roles and permissions',
    icon: '$mdiAccountKey',
    color: '#DDEEFF',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const { loading, data, fetch } = useTableFetch({
  endpoint: 'adm/roles/',
  responseKey: 'roles',
})

const { action } = useFormAction({
  endpoints: {
    insert: 'adm/role/',
  },
  refetchOn: ['insert'],
})

const options = ref<OvTableOptions>({
  key: 'role',
  search: { placeholder: 'role' },
  columns: [
    { name: 'role' },
    { name: 'description', maxLength: 50 },
    {
      name: 'users',
      actions: [
        {
          name: 'users',
          key: 'role',
          format: { icon: '$mdiAccountGroup', to: '/admin/roles/{{value}}' },
        },
      ],
    },
  ],
  actions: [
    {
      name: 'insert',
      key: 'role',
      format: { icon: '$mdiPlus', variant: 'flat' },
      form: {
        fields: [
          { type: 'text', name: 'role', label: 'role' },
          { type: 'text', name: 'description', label: 'description' },
        ],
        actions: ['save', { name: 'cancel', format: { variant: 'outlined' } }],
        actionSubmit: 'save',
        actionCancel: 'cancel',
      },
    },
  ],
  maxLength: 30,
})
</script>
