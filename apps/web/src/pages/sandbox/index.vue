<template>
  <v-card prepend-icon="$mdiHome" title="Sandbox">
    <v-card-text>Content</v-card-text>
    <v-card-actions>
      <v-btn @click="theme.toggle()">Toggle theme</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'
const theme = useTheme()
</script>
