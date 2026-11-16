<template>
  <v-container>
    <v-ov-table
      :options="options"
      title="admin.users"
      description="admin.usersDescription"
      @fetch="fetchUsers"
    />
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvTableOptions, OvTableFetchRequest } from '@/components/api'

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

async function fetchUsers({ cursor, limit, search, signal, complete }: OvTableFetchRequest) {
  const result = await ui.action('admin.users.list', async () => {
    const { data, error } = await http.get<components['schemas']['AdminListUsersResponse']>(
      '/admin/users',
      { query: { cursor, limit, search }, signal },
    )
    if (signal.aborted) return
    if (error || !data) throw new Error('admin.loadUsersError')
    return data
  })
  complete(result.ok ? result.data : undefined)
}
</script>
