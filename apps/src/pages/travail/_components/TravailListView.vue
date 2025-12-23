<template>
  <v-ov-table :options="options" :data="data" :loading="loading" @fetch="fetch"></v-ov-table>
</template>

<script setup lang="ts">
const {
  loading: loading,
  data: data,
  fetch: fetch,
} = useTableFetch({
  endpoint: 'tra/tasks/',
  responseKey: 'tasks',
  filter: { archived: ['true'] },
})

const options = <OvTableOptions>{
  key: 'num',
  search: {
    placeholder: 'title',
  },
  columns: [
    { name: 'num', label: 'key' },
    { name: 'title' },
    { name: 'status' },
    { name: 'priority' },
    { name: 'archived' },
    {
      name: 'actions',
      title: '',
      actions: [
        {
          name: 'details',
          key: 'num',
          format: { icon: '$mdiMagnify', to: '/travail/{{value}}' },
        },
      ],
    },
  ],
  maxLength: 24,
}
</script>
