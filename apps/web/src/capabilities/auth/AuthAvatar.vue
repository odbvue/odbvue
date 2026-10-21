<template>
  <v-avatar color="primary" :size="size">
    <v-img
      v-if="user?.avatarUrl && !failed"
      :src="user.avatarUrl"
      alt=""
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else>{{ avatarInitials(user) }}</span>
  </v-avatar>
</template>

<script setup lang="ts">
import type { AuthUser } from './core'
import { avatarInitials } from './avatar'

const props = withDefaults(defineProps<{ user: AuthUser | null; size?: number }>(), { size: 32 })
const failed = ref(false)
watch(
  () => props.user?.avatarUrl,
  () => {
    failed.value = false
  },
)
</script>
