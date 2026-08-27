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
              <v-chip :color="store.persist ? 'success' : 'default'" size="small">
                {{ store.persist ? store.persist.storage : 'Not persisted' }}
              </v-chip>
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
import { getOdbVueStores, getPersistOptions, useOdbVue, type PersistOptions } from '@odbvue/web'
import { onMounted, ref } from 'vue'

definePage({
  meta: {
    title: 'State',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

type StoreSnapshot = {
  id: string
  currentState: Record<string, unknown>
  persist?: PersistOptions
}

const { pinia } = useOdbVue()
const stores = ref<StoreSnapshot[]>([])

async function refresh() {
  stores.value = getOdbVueStores(pinia).map((store) => ({
    id: store.$id,
    currentState: store.$state,
    persist: getPersistOptions(store),
  }))
}

function formatState(state: unknown): string {
  return state === undefined ? 'No saved state' : JSON.stringify(state, null, 2)
}

async function copyState(state: unknown) {
  await navigator.clipboard.writeText(formatState(state))
}

onMounted(refresh)
</script>
