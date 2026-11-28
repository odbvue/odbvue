<template>
  <v-container>
    <EmailsTable />
  </v-container>
</template>

<script setup lang="ts">
import EmailsTable from '@/modules/admin/components/EmailsTable.vue'

definePage({
  meta: {
    title: 'admin.emails',
    icon: '$mdiEmail',
    access: ['admin'],
    navigation: true,
  },
})
</script>
