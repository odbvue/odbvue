<template>
  <EmailsTable
    :key="user.id"
    :recipient="user.username"
    :state-key="`admin.users.${user.id}.emails`"
  />
</template>

<script setup lang="ts">
import type { components } from '@/api/openapi.generated'
import EmailsTable from '@/modules/admin/components/EmailsTable.vue'

definePage({
  meta: {
    title: 'admin.emails',
    access: ['admin'],
    navigation: false,
  },
})

defineProps<{
  user: components['schemas']['AdminGetUserItemsItem']
  isSelf: boolean
}>()
</script>
