<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="4">
        <v-card color="primary" prepend-icon="$mdiCommentQuestion" to="crm/surveys" hover>
          <v-card-title>{{ t('surveys') }}</v-card-title>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
  <h2>{{ t('discovery.requests') }}</h2>
  <v-ov-table :options="options" :data="data" :loading="loading" @fetch="fetchRequests" />
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'CRM',
    color: '#9C27B0',
    description: 'Discovery requests',
    icon: '$mdiAccountBoxMultiple',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const { t } = useI18n()

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
