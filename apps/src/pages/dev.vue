<script setup lang="ts">
definePage({
  meta: {
    title: 'DEV',
    description: 'Development environment page',
    visibility: 'never',
    access: 'always',
  },
})
import appSchema from '@/api'
</script>

<template>
  <pre>{{ appSchema.toJson() }}</pre>
</template>
