<template>
  <RouterView v-if="isComponentRoute" />
  <v-container v-else>
    <v-row>
      <v-col v-for="component in components" :key="component.to" cols="12" sm="6" md="4">
        <v-card :title="component.title" :prepend-icon="component.icon" class="h-100">
          <v-card-actions>
            <v-btn :to="component.to" append-icon="$mdiArrowRight">Open</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

definePage({
  meta: {
    title: 'Components',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const route = useRoute()
const isComponentRoute = computed(() => route.path !== '/sandbox/capabilities/components')
const components = [
  { title: 'Chart', icon: '$mdiChartBar', to: '/sandbox/capabilities/components/chart' },
  { title: 'Dialog', icon: '$mdiMessageText', to: '/sandbox/capabilities/components/dialog' },
  { title: 'Editor', icon: '$mdiFileDocumentEdit', to: '/sandbox/capabilities/components/editor' },
  { title: 'Form', icon: '$mdiFormSelect', to: '/sandbox/capabilities/components/form' },
  { title: 'Map', icon: '$mdiMap', to: '/sandbox/capabilities/components/map' },
  { title: 'Media', icon: '$mdiMultimedia', to: '/sandbox/capabilities/components/media' },
  { title: 'Pad', icon: '$mdiDraw', to: '/sandbox/capabilities/components/pad' },
  { title: 'Share', icon: '$mdiShareVariant', to: '/sandbox/capabilities/components/share' },
  { title: 'Table', icon: '$mdiTable', to: '/sandbox/capabilities/components/table' },
  { title: 'View', icon: '$mdiEye', to: '/sandbox/capabilities/components/view' },
]
</script>
