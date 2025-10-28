<template>
  <v-card :style="cardBackground">
    <v-card-title><v-icon icon="$mdiHome" />Title</v-card-title>
    <v-card-text>Content</v-card-text>
    <v-card-actions>
      <v-btn @click="console.log('Primary!')" color="primary">Primary</v-btn>
      <v-btn @click="console.log('Secondary!')" color="secondary">Secondary</v-btn>
      <v-btn @click="theme.toggle()">Toggle theme</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useCardBackground } from '@/composables/ui'

const theme = useTheme()
const cardBackground = useCardBackground('#0000ff')
</script>
