<template>
  <v-row>
    <v-col cols="12" md="4" v-for="page in navigationPages" :key="page.path">
      <v-card
        hover
        class="h-100"
        :style="useCardBackground(page.meta.color || '#ffffff').value"
        :prepend-icon="page.meta.icon"
        :title="page.title"
        :to="page.path"
        :text="page.meta.description"
      >
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Home',
    description: 'Welcome to the home page',
    icon: '$mdiHome',
    color: '#ABCDEF',
    visibility: 'always',
    access: 'always',
  },
})
import { useCardBackground } from '@/composables/ui'
const routing = useRouting()
const navigationPages = computed(() =>
  routing.pages.value.filter((page) => page.level === 0 && page.path !== '/'),
)
</script>
