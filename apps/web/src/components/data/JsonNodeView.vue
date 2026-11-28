<template>
  <v-sheet v-if="hasJsonChildren(node)" :min-width="0">
    <v-chip v-if="node.kind === 'array' && depth === 0" class="mb-2" size="small" variant="tonal">
      {{ summary(node) }}
    </v-chip>
    <v-data-table
      v-if="node.kind === 'object' && fields.length"
      class="ov-json-fields"
      :headers="fieldHeaders"
      :items="fields"
      item-value="id"
      hide-default-header
    >
      <template #item.display="{ item }">
        <JsonNodeView :node="item" :depth="depth + 1" />
      </template>
    </v-data-table>
    <v-data-table
      v-if="recordTable"
      class="ov-json-records"
      :headers="headers"
      :items="recordTable.rows"
      item-value="id"
    >
      <template
        v-for="(_column, index) in recordTable.columns"
        :key="index"
        #[`item.column-${index}`]="{ item }"
      >
        <JsonNodeView v-if="item.cells[index]" :node="item.cells[index]" :depth="depth + 1" />
      </template>
    </v-data-table>
    <v-list v-else-if="scalarArray" density="compact" class="pa-0">
      <v-list-item v-for="item in node.children" :key="item.id">
        <JsonNodeView :node="item" :depth="depth + 1" />
      </v-list-item>
    </v-list>
    <v-expansion-panels
      v-if="sections.length"
      v-model="expanded"
      multiple
      variant="accordion"
      class="mt-3"
    >
      <v-expansion-panel v-for="child in sections" :key="child.id" :value="child.id" :elevation="0">
        <template #title>
          {{ label(child) }}
          <v-chip v-if="hasJsonChildren(child)" class="ms-2" size="x-small" variant="tonal">{{
            summary(child)
          }}</v-chip>
        </template>
        <template #text>
          <JsonNodeView :node="child" :depth="depth + 1" />
        </template>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-sheet>
  <v-chip
    v-else-if="node.kind === 'boolean'"
    variant="text"
    size="small"
    class="px-0"
    :prepend-icon="node.display === 'true' ? '$complete' : '$close'"
    :color="node.display === 'true' ? 'success' : undefined"
  >
    {{ t(node.display === 'true' ? 'json.true' : 'json.false') }}
  </v-chip>
  <v-code
    v-else-if="node.kind === 'string' && /[\r\n]/.test(node.display)"
    tag="pre"
    class="ma-0 pa-0 bg-transparent text-pre-wrap text-break"
    >{{ node.display }}</v-code
  >
  <v-card-text
    v-else
    class="pa-0 text-body-2 text-pre-wrap text-break"
    :class="{
      'text-medium-emphasis font-italic':
        node.kind === 'null' ||
        node.kind === 'object' ||
        node.kind === 'array' ||
        node.display === '',
    }"
  >
    {{ node.display === '' ? '""' : node.display }}
  </v-card-text>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  VCardText,
  VChip,
  VCode,
  VDataTable,
  VExpansionPanel,
  VExpansionPanels,
  VList,
  VListItem,
  VSheet,
} from 'vuetify/components'
import { getJsonRecordTable, hasJsonChildren, type JsonNode } from './json'

const props = withDefaults(defineProps<{ node: JsonNode; depth?: number }>(), { depth: 0 })
const { t } = useI18n()
const recordTable = computed(() => getJsonRecordTable(props.node))
const headers = computed(() =>
  recordTable.value?.columns.map((key, index) => ({
    title: key === '' ? '""' : key,
    key: `column-${index}`,
    value: `cells.${index}`,
    maxWidth: 320,
  })),
)
const fieldHeaders = [
  {
    key: 'key',
    value: label,
    width: '30%',
    cellProps: { tag: 'th', scope: 'row', class: 'text-pre-wrap text-break font-weight-medium' },
  },
  { key: 'display' },
]
const fields = computed(() => props.node.children?.filter((child) => !hasJsonChildren(child)) ?? [])
const scalarArray = computed(
  () =>
    props.node.kind === 'array' &&
    props.node.children?.every((child) => child.kind !== 'object' && child.kind !== 'array'),
)
const sections = computed(() => {
  if (props.node.kind === 'object') return props.node.children?.filter(hasJsonChildren) ?? []
  return recordTable.value || scalarArray.value ? [] : (props.node.children ?? [])
})
const expanded = ref(
  sections.value
    .filter((child) => props.depth < 2 || !hasJsonChildren(child))
    .map((child) => child.id),
)

function label(node: JsonNode) {
  return props.node.kind === 'array' ? `[${node.key}]` : node.key === '' ? '""' : node.key
}

function summary(node: JsonNode) {
  const count = node.children?.length ?? 0
  return t(node.kind === 'array' ? 'json.items' : 'json.properties', { count }, count)
}
</script>

<style scoped>
.ov-json-fields :deep(table) {
  table-layout: fixed;
}
</style>
