<template>
  <v-card prepend-icon="$mdiHome" :title="t('sandbox.title')">
    <v-card-text>{{ t('sandbox.description') }}</v-card-text>
    <v-card-actions>
      <v-btn @click="app.settings.toggleTheme()">Toggle theme</v-btn>
      <v-btn @click="locale = 'en'">en</v-btn>
      <v-btn @click="locale = 'fr'">fr</v-btn>
    </v-card-actions>
  </v-card>
  <test-component />
</template>

<route>
  { meta: { layout: 'fullscreen' } }
</route>

<script setup lang="ts">
const app = useAppStore()
const { locale, t } = useI18n()
</script>
