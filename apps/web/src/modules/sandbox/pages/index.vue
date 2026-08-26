<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h3>Runtime</h3>
      </v-col>
      <v-col cols="12" md="4">
        <v-card
          prepend-icon="$mdiServer"
          title="OdbVue runtime"
          subtitle="Framework"
          :text="config.version ? `v${config.version}` : 'Version unspecified'"
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
        >
          <template #append>
            <v-chip :color="isEnabled(capability) ? 'success' : 'default'" size="small">
              {{ isEnabled(capability) ? 'Enabled' : 'Unavailable' }}
            </v-chip>
          </template>
        </v-card>
      </v-col>
    </v-row>
    <v-row class="mt-4">
      <v-col cols="12">
        <h3>Modules</h3>
      </v-col>
      <v-col cols="12">
        <v-card :text="config.modules?.length ? config.modules.join(', ') : 'None'" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { odbVueCapabilities, useOdbVueConfig } from '@odbvue/web'

definePage({
  meta: {
    title: 'Sandbox',
    description: 'A sandbox page to test various UI components and features',
    icon: '$mdiFlask',
    color: '#DDEEFF',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const config = useOdbVueConfig()
const capabilities = odbVueCapabilities

function isEnabled(capability: (typeof odbVueCapabilities)[number]) {
  return capability.required || (capability.configKey && config[capability.configKey] !== false)
}
</script>
