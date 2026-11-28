<template>
  <v-container>
    <AuditTable />
  </v-container>
</template>

<script setup lang="ts">
import AuditTable from '@/modules/admin/components/AuditTable.vue'

definePage({
  meta: {
    title: 'admin.audit',
    icon: '$mdiClipboardTextClock',
    access: ['admin'],
    navigation: true,
  },
})
</script>
