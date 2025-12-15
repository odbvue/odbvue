<template>
  <v-ov-table :options="options" :data="data" :loading="loading" @fetch="fetchRequests" />
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'CRM',
    color: '#4CAF50',
    description: 'Discovery requests',
    icon: '$mdiAccountBoxMultiple',
    visibility: 'when-authenticated',
    access: 'when-authenticated',
  },
})

type CrmRequestsResponse = {
  requests: OvTableData[]
}

const {
  loading,
  data,
  fetch: fetchRequests,
} = useTableFetch<CrmRequestsResponse>({
  endpoint: 'crm/requests/',
  responseKey: 'requests',
})

const options = ref<OvTableOptions>({
  key: 'id',
  search: {
    placeholder: 'name.organization.phone.email',
  },
  columns: [
    { name: 'created' },
    { name: 'name' },
    { name: 'organization' },
    { name: 'phone' },
    { name: 'email' },
    { name: 'message', maxLength: 0 },
  ],
  maxLength: 30,
})
</script>
