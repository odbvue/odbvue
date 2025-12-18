<template>
  <v-ov-table
    :data="detailsData"
    :options="detailsOptions"
    :loading="detailsLoading"
    @fetch="detailsFetch"
  />
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Details',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

import { useRouteParams } from '@/stores/app/navigation'
const { param } = useRouteParams()
const role = param('role')

onMounted(() => {
  useNavigationStore().breadcrumb = role.value
})

onUnmounted(() => {
  useNavigationStore().breadcrumb = ''
})

const {
  data: detailsData,
  loading: detailsLoading,
  fetch: detailsFetch,
} = useTableFetch({
  endpoint: 'adm/users/',
  responseKey: 'users',
  filter: { roles: [role.value] },
})

const detailsOptions = <OvTableOptions>{
  key: 'uuid',
  columns: [
    { name: 'username', label: 'username' },
    { name: 'fullname', label: 'full.name' },
    { name: 'created', label: 'created' },
    { name: 'accessed', label: 'accessed' },
    {
      name: 'status_text',
      label: 'status',
      format: [
        {
          rules: { type: 'contains', params: 'Unverified' },
          color: 'warning',
          icon: '$mdiAlertCircle',
        },
        { rules: { type: 'contains', params: 'Disabled' }, color: 'error', icon: '$mdiAlert' },
        {
          rules: { type: 'contains', params: 'Verified' },
          color: 'success',
          icon: '$mdiInformation',
        },
      ],
    },
  ],
  maxLength: 24,
  canRefresh: false,
}
</script>
