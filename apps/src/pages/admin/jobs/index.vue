<template>
  <v-ov-table ref="jobs" :options :data :loading @fetch="fetch" @action="action"></v-ov-table>
</template>

<script lang="ts" setup>
import type { OvTableData } from '@/components'

definePage({
  meta: {
    title: 'Job Scheduler',
    description: 'View and manage scheduled jobs in the system',
    icon: '$mdiCalendarClock',
    color: '#FFDDDD',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const app = useAppStore()
const http = useHttp()

const jobs = ref<{ fetch: () => void } | null>(null)

const action = async (actionName: string, actionData: OvTableData[], value: OvTableData) => {
  if (['enable', 'disable', 'run'].indexOf(actionName) === -1) return
  if (!value.name) return
  const { status } = await http.post(`adm/job-${actionName}/`, { name: value.name })
  if (status === 200) app.ui.setSuccess('admin.job.action.success')
  else app.ui.setError('admin.job.action.failed')
  jobs.value?.fetch()
}

const { loading, data, fetch } = useTableFetch({
  endpoint: 'adm/jobs/',
  responseKey: 'jobs',
})

const options = ref<OvTableOptions>({
  key: 'name',
  search: {
    value: '',
    label: 'job.name',
  },
  columns: [
    { name: 'name' },
    { name: 'schedule', maxLength: 0 },
    { name: 'started' },
    { name: 'duration' },
    { name: 'comments' },
    { name: 'enabled' },
    {
      name: 'actions',
      actions: [
        {
          name: 'history',
          key: 'name',
          format: { icon: '$mdiHistory', to: '/admin/jobs/{{value}}' },
        },
        {
          name: 'run',
          key: 'enabled',
          format: [
            {
              rules: { type: 'starts-with', params: 'TRUE' },
              icon: '$mdiRun',
              color: 'info',
            },
            { hidden: true },
          ],
        },
        {
          name: 'disable',
          key: 'enabled',
          format: [
            {
              rules: { type: 'starts-with', params: 'TRUE' },
              icon: '$mdiStop',
              color: 'error',
            },
            { hidden: true },
          ],
        },
        {
          name: 'enable',
          key: 'enabled',
          format: [
            {
              rules: { type: 'starts-with', params: 'FALSE' },
              icon: '$mdiPlay',
              color: 'success',
            },
            { hidden: true },
          ],
        },
      ],
    },
  ],
  maxLength: 30,
})
</script>
