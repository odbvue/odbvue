<template>
  <v-defaults-provider
    :defaults="{
      VDataTable: {
        itemsPerPage: -1,
        hideDefaultFooter: true,
        disableSort: true,
        density: 'compact',
        cellProps: { class: 'text-pre-wrap text-break' },
      },
    }"
  >
    <v-sheet :min-width="0" :aria-busy="loading">
      <v-progress-linear v-if="loading" indeterminate :aria-label="t('json.loading')" />
      <v-alert v-else-if="error" type="error" :text="te(error) ? t(error) : error" />
      <v-alert v-else-if="document.error" type="error" :text="t('json.invalid')" />
      <template v-else-if="document.root">
        <v-sheet class="d-flex flex-wrap align-center ga-2 mb-2">
          <v-btn-toggle v-model="mode" mandatory density="compact" :aria-label="t('json.view')">
            <v-btn value="formatted" size="small">{{ t('json.formatted') }}</v-btn>
            <v-btn value="raw" size="small">{{ t('json.raw') }}</v-btn>
          </v-btn-toggle>
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="feedback === 'copied' ? '$mdiCheckCircle' : '$mdiContentCopy'"
            :loading="copying"
            @click="copy"
          >
            {{ t('copy.to.clipboard') }}
          </v-btn>
          <v-chip v-if="feedback === 'copied'" role="status" size="small" color="success">{{
            t('json.copied')
          }}</v-chip>
        </v-sheet>
        <v-alert
          v-if="feedback === 'error'"
          class="mb-2"
          type="error"
          :text="t('json.copyError')"
        />
        <JsonNodeView v-if="mode === 'formatted'" :key="document.raw" :node="document.root" />
        <v-code v-else tag="pre" class="d-block ma-0 pa-3 text-pre-wrap text-break">{{
          document.raw
        }}</v-code>
      </template>
      <v-alert v-else role="status" variant="tonal" type="info" :text="t('json.empty')" />
    </v-sheet>
  </v-defaults-provider>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  VAlert,
  VBtn,
  VBtnToggle,
  VChip,
  VCode,
  VDefaultsProvider,
  VProgressLinear,
  VSheet,
} from 'vuetify/components'
import { createJsonNode, type JsonNode } from './json'
import JsonNodeView from './JsonNodeView.vue'

const props = defineProps<{
  data?: unknown
  loading?: boolean
  error?: string
}>()
const { t, te } = useI18n()
const mode = ref<'formatted' | 'raw'>('formatted')
const copying = ref(false)
const feedback = ref<'copied' | 'error'>()

const document = computed<{ root?: JsonNode; raw?: string; error?: boolean }>(() => {
  if (props.loading || props.error || props.data === undefined) return {}
  try {
    const root = createJsonNode(props.data)
    return { root, raw: JSON.stringify(props.data, null, 2) }
  } catch {
    return { error: true }
  }
})

watch(document, () => {
  feedback.value = undefined
})

async function copy() {
  const current = document.value
  if (current.raw === undefined || copying.value) return
  copying.value = true
  feedback.value = undefined
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(current.raw)
    if (document.value === current) feedback.value = 'copied'
  } catch {
    if (document.value === current) feedback.value = 'error'
  } finally {
    copying.value = false
  }
}
</script>
