<template>
  <v-container v-if="capability">
    <v-btn to="/sandbox" prepend-icon="$mdiArrowLeft" variant="text">Runtime overview</v-btn>
    <v-row class="mt-2">
      <v-col cols="12" md="8">
        <v-card
          :prepend-icon="capability.icon"
          :title="capability.title"
          :subtitle="capability.kind"
        >
          <v-card-text>
            <p>{{ capability.description }}</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card title="Configuration" class="h-100">
          <v-card-text>
            <pre class="text-body-2">{{ configuration }}</pre>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
  <v-container v-else>
    <v-alert
      type="warning"
      title="Unknown capability"
      text="This capability is not registered in the sandbox."
    />
  </v-container>
</template>

<script setup lang="ts">
import { odbVueCapabilities, useOdbVueConfig } from '@odbvue/web'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

definePage({
  meta: {
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const route = useRoute()
const config = useOdbVueConfig()
const capability = computed(() =>
  odbVueCapabilities.find((item) => item.name === route.params.capability),
)
const configuration = computed(() => {
  const options = Object.entries(config).find(([name]) => name === capability.value?.name)?.[1]
  return options === undefined ? 'Default configuration' : JSON.stringify(options, null, 2)
})
</script>
