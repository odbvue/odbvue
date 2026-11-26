<template>
  <v-container>
    <v-ov-table
      ref="table"
      :options="options"
      title="admin.jobs"
      @fetch="fetchJobs"
      @action="onAction"
    />
    <v-ov-dialog
      v-model="confirmDisable"
      :title="t('admin.confirmDisableJob')"
      :content="t('admin.disableJobConfirmation', { name: selectedName })"
      :actions="['admin.cancel', { name: 'admin.disableJob', format: { color: 'warning' } }]"
      action-cancel="admin.cancel"
      action-submit="admin.disableJob"
      @submit="perform('disable', selectedName)"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvTableFetchRequest, OvTableOptions } from '@/components/api'

definePage({
  meta: {
    title: 'admin.jobs',
    icon: '$mdiCalendarClock',
    access: ['admin'],
    navigation: true,
  },
})

const http = useHttp()
const ui = useUi()
const { t } = useI18n()
const router = useRouter()
const table = useTemplateRef('table')
const confirmDisable = ref(false)
const selectedName = ref('')
const saving = ref(false)

const options: OvTableOptions = {
  key: 'jobName',
  stateKey: 'admin.jobs',
  search: { placeholder: 'admin.searchJobs' },
  columns: [
    { name: 'jobName', label: 'admin.jobName' },
    { name: 'state', label: 'admin.status' },
    { name: 'enabled', label: 'admin.enabled' },
    { name: 'scheduleName', label: 'admin.jobSchedule' },
    { name: 'repeatInterval', label: 'admin.jobInterval' },
    { name: 'comments', label: 'admin.description' },
    {
      name: 'actions',
      label: 'admin.roleActions',
      actions: [
        {
          name: 'admin.jobHistory',
          title: 'admin.jobHistory',
          key: 'jobName',
          format: { icon: '$mdiHistory' },
        },
        {
          name: 'admin.runJob',
          title: 'admin.runJob',
          key: 'enabled',
          format: [
            { rules: { type: 'equals', params: 'TRUE' }, icon: '$mdiPlay' },
            { hidden: true },
          ],
        },
        {
          name: 'admin.disableJob',
          title: 'admin.disableJob',
          key: 'enabled',
          format: [
            { rules: { type: 'equals', params: 'TRUE' }, icon: '$mdiPause' },
            { hidden: true },
          ],
        },
        {
          name: 'admin.enableJob',
          title: 'admin.enableJob',
          key: 'enabled',
          format: [
            { rules: { type: 'equals', params: 'FALSE' }, icon: '$mdiPlayCircle' },
            { hidden: true },
          ],
        },
      ],
    },
  ],
}

async function fetchJobs({ cursor, limit, search, signal, complete }: OvTableFetchRequest) {
  const result = await ui.action('admin.jobs.list', async () => {
    const { data, error } = await http.get<components['schemas']['AdminListJobsResponse']>(
      '/admin/jobs',
      { query: { cursor, limit, search }, signal },
    )
    if (signal.aborted) return
    if (error || !data) throw new Error('admin.loadJobsError')
    return data
  })
  if (signal.aborted || !result.ok || !result.data) return complete()
  complete(result.data)
}

function onAction(action: string, _rows: unknown, row?: unknown) {
  if (!['admin.jobHistory', 'admin.disableJob', 'admin.enableJob', 'admin.runJob'].includes(action))
    return
  if (saving.value) return
  if (
    !row ||
    typeof row !== 'object' ||
    !('jobName' in row) ||
    typeof row.jobName !== 'string' ||
    !row.jobName
  )
    return ui.error('admin.jobActionError')
  if (action === 'admin.jobHistory') {
    void router.push(`/admin/jobs/${encodeURIComponent(row.jobName)}`)
  } else if (action === 'admin.disableJob') {
    selectedName.value = row.jobName
    confirmDisable.value = true
  } else if (action === 'admin.enableJob') {
    void perform('enable', row.jobName)
  } else if (action === 'admin.runJob') {
    void perform('run', row.jobName)
  }
}

async function perform(action: 'enable' | 'disable' | 'run', name: string) {
  if (saving.value) return
  saving.value = true
  try {
    const result = await ui.action('admin.jobs.action', async () => {
      const { error } = await http.post(`/admin/jobs/${encodeURIComponent(name)}/${action}`)
      if (error) throw new Error('admin.jobActionError')
    })
    if (!result.ok) return
    confirmDisable.value = false
    ui.success('admin.jobActionSuccess')
    await table.value?.fetch('first')
  } finally {
    saving.value = false
  }
}
</script>
