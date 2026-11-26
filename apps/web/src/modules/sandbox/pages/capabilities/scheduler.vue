<template>
  <v-container>
    <h3>{{ t('sandbox.scheduler') }}</h3>
    <p>{{ t('sandbox.schedulerDescription') }}</p>
    <v-chip class="mt-4" :color="status?.enabled === 'TRUE' ? 'success' : 'warning'">
      {{
        t(
          status
            ? status.enabled === 'TRUE'
              ? 'sandbox.schedulerEnabled'
              : 'sandbox.schedulerDisabled'
            : 'sandbox.schedulerUnknown',
        )
      }}
    </v-chip>
    <p v-if="status" class="mt-2">{{ t('sandbox.schedulerState') }}: {{ status.state }}</p>
    <div class="d-flex ga-2 mt-4">
      <v-btn
        color="primary"
        :loading="busy === 'enable'"
        :disabled="!!busy || loadingStatus || !status || status.enabled === 'TRUE'"
        @click="change('enable')"
      >
        {{ t('sandbox.schedulerStart') }}
      </v-btn>
      <v-btn
        :loading="busy === 'disable'"
        :disabled="!!busy || loadingStatus || !status || status.enabled !== 'TRUE'"
        @click="change('disable')"
      >
        {{ t('sandbox.schedulerStop') }}
      </v-btn>
      <v-btn :disabled="!!busy || loadingStatus" :loading="loadingStatus" @click="refresh">
        {{ t('sandbox.schedulerRefresh') }}
      </v-btn>
    </div>
    <v-ov-table
      ref="auditTable"
      class="mt-4"
      :options="auditOptions"
      title="sandbox.schedulerAudit"
      @fetch="fetchAudit"
    />
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvTableFetchRequest, OvTableOptions } from '@/components/api'

definePage({
  meta: {
    title: 'sandbox.scheduler',
    icon: '$mdiCalendarClock',
    access: ['admin'],
    navigation: true,
  },
})

const { t } = useI18n()
const http = useHttp()
const ui = useUi()
const busy = ref<'enable' | 'disable'>()
const loadingStatus = ref(false)
const status = ref<components['schemas']['SandboxReadSchedulerResponse']>()
const auditTable = useTemplateRef('auditTable')
const auditOptions: OvTableOptions = {
  key: 'id',
  columns: [
    { name: 'eventTimestamp', label: 'sandbox.schedulerTime', format: { tsFormat: 'datetime' } },
    { name: 'severityText', label: 'sandbox.schedulerSeverity' },
    { name: 'body', label: 'sandbox.schedulerMessage' },
    { name: 'attributes', label: 'sandbox.schedulerDetails', maxLength: 0 },
  ],
}

async function loadStatus() {
  loadingStatus.value = true
  status.value = undefined
  try {
    const result = await ui.action('sandbox.scheduler.status', async () => {
      const { data, error } =
        await http.get<components['schemas']['SandboxReadSchedulerResponse']>('/sandbox/scheduler')
      if (error || !data || !['TRUE', 'FALSE'].includes(data.enabled)) {
        throw new Error('sandbox.schedulerLoadError')
      }
      return data
    })
    if (result.ok) status.value = result.data
  } finally {
    loadingStatus.value = false
  }
}

async function fetchAudit({ cursor, limit, signal, complete }: OvTableFetchRequest) {
  const result = await ui.action('sandbox.scheduler.audit', async () => {
    const { data, error } = await http.get<
      components['schemas']['SandboxListSchedulerAuditResponse']
    >('/sandbox/scheduler/audit', { query: { cursor, limit }, signal })
    if (signal.aborted) return
    if (error || !data) throw new Error('sandbox.schedulerAuditError')
    return data
  })
  if (signal.aborted || !result.ok || !result.data) return complete()
  complete(result.data)
}

async function refresh() {
  await Promise.all([loadStatus(), auditTable.value?.fetch('first')])
}

onMounted(loadStatus)

async function change(action: 'enable' | 'disable') {
  if (busy.value) return
  busy.value = action
  try {
    const result = await ui.action('sandbox.scheduler.action', async () => {
      const { error } = await http.post(`/sandbox/scheduler/${action}`)
      if (error) throw new Error('sandbox.schedulerError')
    })
    if (result.ok) {
      ui.success('sandbox.schedulerSuccess')
      await refresh()
    }
  } finally {
    busy.value = undefined
  }
}
</script>
