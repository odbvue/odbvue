<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h3>Preferences</h3>
      </v-col>
      <v-col cols="12" md="6">
        <v-card title="Display" prepend-icon="$mdiVuetify" class="h-100">
          <v-card-text class="d-flex flex-wrap ga-2">
            <v-btn @click="preferences.toggleTheme()" :prepend-icon="preferences.themeIcon">
              Toggle theme
            </v-btn>
            <v-btn-toggle :model-value="preferences.fontSize" density="compact" mandatory divided>
              <v-btn
                v-for="fontSize in preferences.fontSizes"
                :key="fontSize"
                :value="fontSize"
                @click="preferences.setFontSize(fontSize)"
              >
                {{ fontSize }}%
              </v-btn>
            </v-btn-toggle>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12">
        <h3>Vuetify Runtime</h3>
      </v-col>
      <v-col cols="12" md="4">
        <v-card title="Themes" prepend-icon="$mdiPalette" class="h-100">
          <v-card-text>
            <v-sheet
              border
              class="overflow-auto pa-4 bg-surface-light"
              max-height="18em"
              min-height="18em"
            >
              <pre class="ma-0"><code>{{ formatConfiguration(config.ui?.theme) }}</code></pre>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card title="Component defaults" prepend-icon="$mdiTune" class="h-100">
          <v-card-text>
            <v-sheet
              border
              class="overflow-auto pa-4 bg-surface-light"
              max-height="18em"
              min-height="18em"
            >
              <pre class="ma-0"><code>{{ formatConfiguration(config.ui?.defaults) }}</code></pre>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card title="Icon aliases" prepend-icon="$mdiShape" class="h-100">
          <v-card-text>
            <v-sheet
              border
              class="overflow-auto pa-2 bg-surface-light"
              max-height="18em"
              min-height="18em"
            >
              <v-list density="compact" bg-color="transparent">
                <v-list-item v-for="icon in iconAliases" :key="icon" :title="`$${icon}`">
                  <template #prepend>
                    <v-icon :icon="`$${icon}`" />
                  </template>
                </v-list-item>
                <v-list-item v-if="!iconAliases.length" title="None configured" />
              </v-list>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12">
        <h3>Feedback</h3>
      </v-col>
      <v-col cols="12">
        <v-card title="UI feedback" prepend-icon="$mdiMessageAlert">
          <v-card-text class="d-flex flex-wrap ga-2">
            <v-btn color="info" @click="ui.info('Info message')">Info</v-btn>
            <v-btn color="success" @click="ui.success('Success message')">Success</v-btn>
            <v-btn color="warning" @click="ui.warning('Warning message')">Warning</v-btn>
            <v-btn color="error" @click="ui.error('Error message')">Error</v-btn>
            <v-btn color="primary" @click="ui.snack('Snackbar message')">Snackbar</v-btn>
            <v-btn @click="ui.startLoading()">Start loading</v-btn>
            <v-btn @click="ui.stopLoading()">Stop loading</v-btn>
            <v-btn @click="ui.clear()">Clear</v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useOdbVue, usePreferencesStore, useUi } from '@odbvue/web'
import { computed } from 'vue'

definePage({
  meta: {
    title: 'UI',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const preferences = usePreferencesStore()
const ui = useUi()
const { config } = useOdbVue()
const iconAliases = computed(() => Object.keys(config.ui?.icons ?? {}))

function formatConfiguration(value: unknown): string {
  return value === undefined ? 'None configured' : JSON.stringify(value, null, 2)
}
</script>
