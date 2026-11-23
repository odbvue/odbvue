<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h3>{{ t('sandbox.ui.preferences') }}</h3>
      </v-col>
      <v-col cols="12" md="6">
        <v-card :title="t('sandbox.ui.display')" prepend-icon="$mdiVuetify" class="h-100">
          <v-card-text class="d-flex flex-wrap ga-2">
            <v-btn @click="preferences.toggleTheme()" :prepend-icon="preferences.themeIcon">
              {{ t('sandbox.ui.toggleTheme') }}
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
        <h3>{{ t('sandbox.ui.runtime') }}</h3>
      </v-col>
      <v-col cols="12" md="4">
        <v-card :title="t('sandbox.ui.themes')" prepend-icon="$mdiPalette" class="h-100">
          <v-card-text>
            <v-sheet
              border
              class="overflow-auto pa-4 bg-surface-light"
              max-height="18em"
              min-height="18em"
            >
              <pre class="ma-0"><code>{{ formatConfiguration(appConfig.ui?.theme) }}</code></pre>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card :title="t('sandbox.ui.defaults')" prepend-icon="$mdiTune" class="h-100">
          <v-card-text>
            <v-sheet
              border
              class="overflow-auto pa-4 bg-surface-light"
              max-height="18em"
              min-height="18em"
            >
              <pre class="ma-0"><code>{{ formatConfiguration(appConfig.ui?.defaults) }}</code></pre>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card :title="t('sandbox.ui.icons')" prepend-icon="$mdiShape" class="h-100">
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
                <v-list-item v-if="!iconAliases.length" :title="t('sandbox.ui.none')" />
              </v-list>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12">
        <h3>{{ t('sandbox.ui.feedback') }}</h3>
      </v-col>
      <v-col cols="12" md="6">
        <v-card :title="t('sandbox.ui.alerts')" prepend-icon="$mdiMessageAlert" class="h-100">
          <v-card-text>{{ t('sandbox.ui.alertDescription') }}</v-card-text>
          <v-card-text class="d-flex flex-wrap ga-2">
            <v-btn
              v-for="type in severities"
              :key="type"
              :color="type"
              @click="ui.alert(`sandbox.ui.message.${type}`, { type })"
            >
              {{ t(`sandbox.ui.${type}`) }}
            </v-btn>
            <v-btn @click="ui.alert('sandbox.ui.timedMessage', { type: 'warning', timeout: 5000 })">
              {{ t('sandbox.ui.timedAlert') }}
            </v-btn>
            <v-btn @click="ui.clearAlert()">{{ t('sandbox.ui.clearAlert') }}</v-btn>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card :title="t('sandbox.ui.snackbars')" prepend-icon="$mdiMessageAlert" class="h-100">
          <v-card-text>{{ t('sandbox.ui.snackbarDescription') }}</v-card-text>
          <v-card-text class="d-flex flex-wrap ga-2">
            <v-btn
              v-for="type in severities"
              :key="type"
              :color="type"
              @click="ui[type](`sandbox.ui.message.${type}`)"
            >
              {{ t(`sandbox.ui.${type}`) }}
            </v-btn>
            <v-btn color="primary" @click="queueMessages">
              {{ t('sandbox.ui.queueMessages') }}
            </v-btn>
            <v-btn @click="ui.snack('sandbox.ui.persistentMessage', { timeout: 0 })">
              {{ t('sandbox.ui.persistentSnackbar') }}
            </v-btn>
            <v-btn @click="ui.clearSnackbars()">{{ t('sandbox.ui.clearSnackbars') }}</v-btn>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12">
        <v-card :title="t('sandbox.ui.loading')" prepend-icon="$mdiTune">
          <v-card-text>{{ t('sandbox.ui.loadingDescription') }}</v-card-text>
          <v-card-text class="d-flex flex-wrap ga-2">
            <v-btn :disabled="ui.loading.has('sandbox.demo')" @click="startLoading">
              {{ t('sandbox.ui.startLoading') }}
            </v-btn>
            <v-btn @click="ui.clear()">{{ t('sandbox.ui.clearAll') }}</v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { appConfig } from '@/capabilities/config'
import { usePreferencesStore, useUi, type UiNotificationType } from '@/capabilities/ui'
import { computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

definePage({
  meta: {
    title: 'sandbox.ui.title',
    access: ['admin'],
    navigation: true,
  },
})

const preferences = usePreferencesStore()
const ui = useUi()
const { t } = useI18n()
const severities: UiNotificationType[] = ['info', 'success', 'warning', 'error']
let stopLoading: (() => void) | undefined
let loadingTimer: ReturnType<typeof setTimeout> | undefined
function startLoading() {
  if (stopLoading) return
  stopLoading = ui.loading.start('sandbox.demo')
  loadingTimer = setTimeout(finishLoading, 2000)
}
function finishLoading() {
  if (loadingTimer !== undefined) clearTimeout(loadingTimer)
  loadingTimer = undefined
  stopLoading?.()
  stopLoading = undefined
}
onBeforeUnmount(finishLoading)
const iconAliases = computed(() => Object.keys(appConfig.ui?.icons ?? {}))

function formatConfiguration(value: unknown): string {
  return value === undefined ? t('sandbox.ui.none') : JSON.stringify(value, null, 2)
}

function queueMessages() {
  for (const type of severities) ui[type](`sandbox.ui.message.${type}`)
}
</script>
