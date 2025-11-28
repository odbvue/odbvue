<template>
  <v-ov-table :options :data :t :loading @fetch="fetchUsers"></v-ov-table>
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

const {
  loading,
  data,
  fetch: fetchUsers,
} = useTableFetch<UserResponse>({
  endpoint: 'adm/users/',
  responseKey: 'users',
})

const options = ref<OvTableOptions>({
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
})
</script>
