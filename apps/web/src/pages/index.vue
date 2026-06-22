<template>
  <h1>{{ t('home.title') }}</h1>
  <p>{{ t('home.description') }}</p>
</template>

<route>
  {
    "meta": {
      "title": "Home"
    },
  }
</route>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
