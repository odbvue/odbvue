<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h3>Application</h3>
      </v-col>
      <v-col cols="12" md="4">
        <v-card
          prepend-icon="$mdiServer"
          title="OdbVue web application"
          subtitle="Vue + Pinia + Vue Router + Vuetify"
          :text="appConfig.version ? `v${appConfig.version}` : 'Version unspecified'"
          class="h-100"
        />
      </v-col>
    </v-row>
    <v-row class="mt-4">
      <v-col cols="12">
        <h3>Capabilities</h3>
      </v-col>
      <v-col cols="12" md="6" lg="4" v-for="capability in capabilities" :key="capability.name">
        <v-card
          :to="`/sandbox/capabilities/${capability.name}`"
          :prepend-icon="capability.icon"
          :title="capability.title"
          :subtitle="capability.kind"
          :text="capability.description"
          class="h-100"
          hover
        />
      </v-col>
    </v-row>
    <v-row class="mt-4">
      <v-col cols="12">
        <h3>Modules</h3>
      </v-col>
      <v-col cols="12">
        <v-card :text="modules.length ? modules.join(', ') : 'None'" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { odbVueCapabilities } from '@/modules/sandbox/catalog'
import { appConfig } from '@/capabilities/config'

definePage({
  meta: {
    title: 'Sandbox',
    description: 'A sandbox page to test various UI components and features',
    icon: '$mdiFlask',
    color: '#DDEEFF',
    access: ['admin'],
    navigation: true,
  },
})

const capabilities = odbVueCapabilities
const routing = useRouting()
const modules = computed(() =>
  [
    ...new Set(
      routing.allPages.value.map((page) => page.module).filter((module) => module !== undefined),
    ),
  ].toSorted(),
)
</script>
