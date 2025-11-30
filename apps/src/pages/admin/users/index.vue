<template>
  <v-ov-table :options="options" :data="data" :loading="loading" @fetch="fetch"></v-ov-table>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const {
  loading: loading,
  data: data,
  fetch: fetch,
} = useTableFetch({
  endpoint: 'adm/users/',
  responseKey: 'users',
})

const options = <OvTableOptions>{
  key: 'uuid',
  search: {
    placeholder: 'username',
  },
  columns: [
    { name: 'username' },
    { name: 'fullname' },
    { name: 'created' },
    { name: 'accessed' },
    {
      name: 'status_text',
      title: 'status',
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
    {
      name: 'actions',
      title: '',
      actions: [
        {
          name: 'details',
          key: 'uuid',
          format: { icon: '$mdiMagnify', to: '/admin/users/{{value}}' },
        },
      ],
    },
  ],
  maxLength: 24,
}
</script>
