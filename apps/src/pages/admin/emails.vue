<template>
  <v-ov-table :options="emailOptions" :data="data" :t :loading="loading" @fetch="fetchEmails"></v-ov-table>
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

const { t } = useI18n()

const emailOptions: OvTableOptions = {
    key: 'id',
    columns: [
      { name: 'created' },
      { name: 'to' },
      { name: 'subject' },
      { name: 'status' },
      { name: 'error', maxLength: 0 },
    ],
    maxLength: 30,
}

type EmailResponse = {
  emails: Array<{
    id: string
    created: string
    subject: string
    to: string
    status: string
    error: string
  }>
}

const {
  loading,
  data,
  fetch: fetchEmails,
} = useTableFetch<EmailResponse>({
  endpoint: 'adm/emails/',
  responseKey: 'emails',
})
</script>