<template>
  <v-container>
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
import { computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCursorQuery, useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvFilterValue, OvTableData, OvTableOptions } from '@/components/api'

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
const ui = useUi()
const { items, nextCursor, loading, load } = useCursorQuery({
  loadingKey: 'admin.users.list',
  fetch: ({ signal, ...query }) =>
    http.get<components['schemas']['AdminListUsersResponse']>('/admin/users', { query, signal }),
  onError: () => ui.error('admin.loadUsersError'),
})
onBeforeUnmount(() => ui.clear())

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

async function fetchUsers(
  _data: OvTableData[],
  cursor: string | undefined,
  limit: number,
  search?: string,
  _filter?: OvFilterValue,
  _sort?: string,
  complete?: (success: boolean) => void,
) {
  ui.clear()
  const success = await load({ cursor, limit, search })
  if (success && !items.value.length) ui.info('admin.noUsers')
  complete?.(success)
}
</script>
