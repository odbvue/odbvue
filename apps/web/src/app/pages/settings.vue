<template>
  <v-container max-width="760">
    <h1 class="mb-4">{{ t('settings.title') }}</h1>
    <v-tabs color="primary" class="mb-6" :aria-label="t('settings.title')">
      <v-tab to="/settings/account">{{ t('auth.account.title') }}</v-tab>
    </v-tabs>
    <RouterView />
  </v-container>
</template>

<script setup lang="ts">
definePage({ meta: { title: 'Settings', access: 'authenticated', navigation: true } })

const { t } = useI18n()
</script>
