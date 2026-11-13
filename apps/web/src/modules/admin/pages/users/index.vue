<template>
  <v-container>
    <v-alert v-if="error" type="error" :text="t('admin.loadUsersError')" class="mb-4" />
    <v-alert
      v-else-if="loaded && !loading && !items.length"
      type="info"
      :text="t('admin.noUsers')"
      class="mb-4"
    />
    <v-ov-table
      :options="options"
      :items="items"
      :next-cursor="nextCursor"
      :loading="loading"
      title="admin.users"
      description="admin.usersDescription"
      @fetch="fetchUsers"
    />
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCursorQuery, useHttp } from '@/capabilities/http'
import type { components } from '@/api/openapi.generated'
import type { OvTableData, OvTableOptions } from '@/components/api'

definePage({
  meta: {
    title: 'admin.users',
    icon: '$mdiAccountGroup',
    access: ['admin'],
    navigation: true,
  },
})

const { t } = useI18n()
const http = useHttp()
const { items, nextCursor, loading, loaded, error, load } = useCursorQuery({
  fetch: ({ signal, ...query }) =>
    http.get<components['schemas']['AdminListUsersResponse']>('/admin/users', { query, signal }),
})

const options = computed<OvTableOptions>(() => ({
  key: 'id',
  itemsPerPage: 5,
  mobileItemsPerPage: 5,
  search: { placeholder: t('admin.searchUsers') },
  columns: [
    { name: 'username', label: 'admin.username' },
    { name: 'displayName', label: 'admin.displayName' },
    {
      name: 'enabled',
      label: 'admin.status',
      format: [
        {
          rules: { type: 'equals', params: 'true' },
          text: t('admin.enabled'),
          color: 'success',
          icon: '$mdiCheckCircle',
        },
        { text: t('admin.disabled'), color: 'warning', icon: '$mdiAccountOff' },
      ],
    },
    {
      name: 'createdAt',
      label: 'admin.createdAt',
      format: { tsFormat: 'datetime' },
    },
    {
      name: 'actions',
      label: 'admin.details',
      actions: [
        {
          name: 'admin.details',
          key: 'id',
          format: { icon: '$mdiMagnify', to: '/admin/users/{{value}}' },
        },
      ],
    },
  ],
}))

function fetchUsers(
  _data: OvTableData[],
  cursor: string | undefined,
  limit: number,
  search?: string,
) {
  return load({ cursor, limit, search })
}
</script>
