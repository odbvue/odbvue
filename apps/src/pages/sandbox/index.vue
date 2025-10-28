<template>
  <v-card :style="cardBackground">
    <v-card-title
      ><v-icon icon="$mdiHome" /><v-icon icon="$mdiHeart" />{{ t('sandbox.title') }}</v-card-title
    >
    <v-card-text>{{ t('sandbox.description') }}</v-card-text>
    <v-card-actions>
      <v-btn @click="console.log('Primary!')" color="primary">Primary</v-btn>
      <v-btn @click="console.log('Secondary!')" color="secondary">Secondary</v-btn>
      <v-btn @click="settings.themeToggle()">Toggle theme</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
const cardBackground = useCardBackground('#0000ff')
const { t } = useI18n()
const settings = useSettingsStore()
</script>
