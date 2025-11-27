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
  key: 'users',
  search: {
    placeholder: 'username',
  },
  columns: [
    { name: 'username' },
    { name: 'fullname' },
    { name: 'created' },
    { name: 'accessed' },
    { name: 'status_text', format: { text: 'status' } },
  ],
  maxLength: 30,
})
</script>
