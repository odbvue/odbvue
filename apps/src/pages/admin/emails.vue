<template>
  <v-ov-table :options="options" :data="data" :loading="loading" @fetch="fetchEmails"></v-ov-table>
</template>
<script setup lang="ts">
definePage({
  meta: {
    title: 'Email Logs',
    description: 'View email logs sent by the system',
    icon: '$mdiEmail',
    color: '#FFDDDD',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const {
  loading,
  data,
  fetch: fetchEmails,
} = useTableFetch({
  endpoint: 'adm/emails/',
  responseKey: 'emails',
})

const options = ref<OvTableOptions>({
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
