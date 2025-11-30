<template>
  <v-ov-table
    :options="historyOptions"
    :data="historyData"
    :loading="historyLoading"
    @fetch="historyFetch"
  ></v-ov-table>
</template>

<script setup lang="ts">
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

// history

const route = useRoute()
const name =
  'name' in route.params
    ? Array.isArray(route.params.name)
      ? route.params.name[0]
      : route.params.name
    : ''

const {
  loading: historyLoading,
  data: historyData,
  fetch: historyFetch,
} = useTableFetch({
  endpoint: 'adm/jobs-history/',
  responseKey: 'items',
  filter: { name: [name] },
})

const historyOptions = ref<OvTableOptions>({
  key: 'name',
  columns: [
    { name: 'name' },
    { name: 'started' },
    { name: 'duration' },
    { name: 'status' },
    { name: 'output' },
  ],
  maxLength: 30,
})
</script>
