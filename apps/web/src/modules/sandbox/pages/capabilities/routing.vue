<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h3>Routing</h3>
        <p>Total routes: {{ String(pages.length) }}</p>
      </v-col>
      <v-col v-for="page in pages" :key="page.path" cols="12" md="6" lg="4">
        <v-card class="h-100">
          <v-card-item :prepend-icon="page.meta.icon || '$mdiFileDocumentOutline'">
            <v-card-title>{{ page.title || page.path }}</v-card-title>
            <v-card-subtitle>{{ page.path }}</v-card-subtitle>
            <template #append>
              <v-btn
                icon="$mdiContentCopy"
                variant="text"
                :aria-label="`Copy metadata for ${page.path}`"
                @click.stop="copyMetadata(page.meta)"
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
              <pre class="ma-0"><code>{{ toYaml(page.meta) }}</code></pre>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useRouting, type OdbVuePageMeta } from '@odbvue/web'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

definePage({
  meta: {
    title: 'Routing',
    description: 'Inspect generated pages, metadata, and navigation conventions.',
    icon: '$mdiRoutes',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const route = useRoute()
const { currentModule, currentPage, pages: allPages } = useRouting()
const pages = computed(() =>
  allPages.value.toSorted((first, second) => first.path.localeCompare(second.path)),
)

function isStaticRoute(path: string): boolean {
  return !path.includes(':')
}

function toYaml(meta: OdbVuePageMeta): string {
  return Object.entries(meta)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: [${value.map(yamlValue).join(', ')}]`
      if (value && typeof value === 'object') {
        const properties = Object.entries(value)
          .map(([nestedKey, nestedValue]) => `  ${nestedKey}: ${yamlValue(nestedValue)}`)
          .join('\n')
        return `${key}:\n${properties}`
      }
      return `${key}: ${yamlValue(value)}`
    })
    .join('\n')
}

function yamlValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

async function copyMetadata(meta: OdbVuePageMeta) {
  await navigator.clipboard.writeText(toYaml(meta))
}
</script>
