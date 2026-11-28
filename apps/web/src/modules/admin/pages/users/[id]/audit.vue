<template>
  <AuditTable :key="user.id" :user-id="user.id" :state-key="`admin.users.${user.id}.audit`" />
</template>

<script setup lang="ts">
import type { components } from '@/api/openapi.generated'
import AuditTable from '@/modules/admin/components/AuditTable.vue'

definePage({
  meta: {
    title: 'admin.audit',
    access: ['admin'],
    navigation: false,
  },
})

defineProps<{
  user: components['schemas']['AdminGetUserItemsItem']
  isSelf: boolean
}>()
</script>
