<template>
  <v-container>
    <v-ov-table :options="options" title="admin.jobHistory" @fetch="fetchHistory" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, onUnmounted, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { computedRouteParam, useRouting } from '@/capabilities/routing'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvTableFetchRequest, OvTableOptions } from '@/components/api'

definePage({
  meta: {
    title: 'admin.jobHistory',
    icon: '$mdiHistory',
    access: ['admin'],
    navigation: false,
  },
})

const name = computedRouteParam(useRoute(), 'name')
const routing = useRouting()
const http = useHttp()
const ui = useUi()
watchEffect(() => routing.setBreadcrumb(name.value))
onUnmounted(() => routing.setBreadcrumb())

const options = computed<OvTableOptions>(() => ({
  key: 'logId',
  stateKey: `admin.jobs.${name.value}.history`,
  columns: [
    { name: 'actualStartDate', label: 'admin.jobStarted', format: { tsFormat: 'datetime' } },
    { name: 'runDuration', label: 'admin.jobDuration' },
    { name: 'status', label: 'admin.status' },
    { name: 'errors', label: 'admin.jobErrors', maxLength: 0 },
    { name: 'output', label: 'admin.jobOutput', maxLength: 0 },
  ],
}))

async function fetchHistory({ cursor, limit, signal, complete }: OvTableFetchRequest) {
  const result = await ui.action('admin.jobs.history', async () => {
    const { data, error } = await http.get<components['schemas']['AdminListJobHistoryResponse']>(
      `/admin/jobs/${encodeURIComponent(name.value)}/history`,
      { query: { cursor, limit }, signal },
    )
    if (signal.aborted) return
    if (error || !data) throw new Error('admin.loadJobHistoryError')
    return data
  })
  if (signal.aborted || !result.ok || !result.data) return complete()
  complete(result.data)
}
</script>
