<template>
  <v-container>
    <v-row>
      <v-col>
        <h3>Installed stores</h3>
      </v-col>
    </v-row>

    <v-alert
      v-if="!stores.length"
      type="info"
      title="No stores are active"
      text="Stores appear here after they are first used by the application."
    />

    <v-row v-else class="pt-4">
      <v-col v-for="store in stores" :key="store.id" cols="12" md="6" lg="4">
        <v-card class="h-100">
          <v-card-item prepend-icon="$mdiDatabase">
            <v-card-title>{{ store.id }}</v-card-title>
            <template #append>
              <v-btn
                icon="$mdiContentCopy"
                variant="text"
                :aria-label="`Copy state for ${store.id}`"
                @click="copyState(store.currentState)"
              />
            </template>
          </v-card-item>
          <v-card-text>
            <v-sheet
              border
              class="overflow-auto pa-4 bg-surface-light"
              max-height="14em"
              min-height="14em"
              rounded="lg"
            >
              <pre class="ma-0"><code>{{ formatState(store.currentState) }}</code></pre>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { pinia } from '@/app/state'
import { computed } from 'vue'

definePage({
  meta: {
    title: 'State',
    access: ['admin'],
    navigation: true,
  },
})

const stores = computed(() =>
  Object.entries(pinia.state.value).map(([id, currentState]) => ({ id, currentState })),
)

function formatState(state: unknown): string {
  return state === undefined ? 'No saved state' : JSON.stringify(state, null, 2)
}

async function copyState(state: unknown) {
  await navigator.clipboard.writeText(formatState(state))
}
</script>
