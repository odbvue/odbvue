<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h3>Internationalization</h3>
      </v-col>
      <v-col cols="12" md="4">
        <v-card
          title="Configured locales"
          :subtitle="`Fallback locale: ${fallbackLocale}`"
          prepend-icon="$mdiTranslate"
          class="h-100"
        >
          <v-card-text class="d-flex flex-wrap ga-2">
            <v-btn
              v-for="locale in locales"
              :key="locale"
              :color="locale === currentLocale ? 'primary' : undefined"
              :variant="locale === currentLocale ? 'flat' : 'outlined'"
              @click="setLocale(locale)"
            >
              {{ locale }}
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12">
        <h3>Translation keys</h3>
      </v-col>
      <v-col cols="12">
        <v-ov-table :options="tableOptions" :items="tableItems" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useOdbVue, usePreferencesStore } from '@odbvue/web'
import type { OvTableData, OvTableOptions } from '@odbvue/web/components'
import { computed } from 'vue'
import inventory from 'virtual:odbvue-i18n-inventory'

definePage({
  meta: {
    title: 'Internationalization',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

type I18nGlobal = {
  messages: { value: Record<string, unknown> }
  locale: { value: string }
  fallbackLocale: { value: unknown }
}

const { config, i18n } = useOdbVue()
const preferences = usePreferencesStore()
const global = i18n.global as I18nGlobal
const locales = computed(() => config.i18n?.locales ?? Object.keys(global.messages.value))
const currentLocale = computed(() => global.locale.value)
const fallbackLocale = computed(() => String(global.fallbackLocale.value))
const appMessages = inventory.app
const moduleMessages = inventory.modules
const moduleNames = Object.keys(moduleMessages)

const tableItems = computed<OvTableData[]>(() => [
  translationRow('Main application', appMessages),
  ...moduleNames.map((moduleName) => translationRow(moduleName, moduleMessages[moduleName] ?? {})),
])
const tableOptions = computed<OvTableOptions>(() => ({
  key: 'module',
  canRefresh: false,
  columns: [
    { name: 'module', label: 'Module' },
    { name: currentLocale.value, label: currentLocale.value, align: 'right' },
    { name: 'coverage', label: 'All locales', align: 'right' },
    { name: 'missing', label: 'Missing', align: 'right' },
  ],
}))

function translationRow(module: string, translations: Record<string, number>): OvTableData {
  const translated = locales.value.reduce((count, locale) => count + (translations[locale] ?? 0), 0)
  const expected =
    Math.max(...locales.value.map((locale) => translations[locale] ?? 0), 0) * locales.value.length
  const missing = expected - translated

  return {
    module,
    ...Object.fromEntries(locales.value.map((locale) => [locale, translations[locale] ?? 0])),
    coverage: `${translated} / ${expected}`,
    missing,
  }
}

function setLocale(locale: string) {
  preferences.setLocale(locale)
}
</script>
