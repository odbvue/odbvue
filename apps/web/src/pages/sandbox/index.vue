<template>
  <v-card prepend-icon="$mdiHome" :title="t('sandbox.title')">
    <v-card-text>{{ t('sandbox.description') }}</v-card-text>
    <v-card-actions>
      <v-btn @click="theme.toggle()">Toggle theme</v-btn>
      <v-btn @click="locale = 'en'">en</v-btn>
      <v-btn @click="locale = 'fr'">fr</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'

const theme = useTheme()
const { locale, t } = useI18n()
</script>
