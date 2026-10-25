<template>
  <span />
</template>

<script setup lang="ts">
definePage({
  meta: { title: 'Settings', access: 'public', navigation: false },
  redirect: (to) => ({ path: '/settings/account', query: to.query, hash: to.hash }),
})
</script>
