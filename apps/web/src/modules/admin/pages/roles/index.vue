<template>
  <v-container>
    <v-ov-table
      :options="options"
      title="admin.roles"
      description="admin.rolesDescription"
      @fetch="fetchRoles"
    />
  </v-container>
</template>

<script setup lang="ts">
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvTableOptions, OvTableFetchRequest } from '@/components/api'

definePage({
  meta: {
    title: 'admin.roles',
    icon: '$mdiKey',
    access: ['admin'],
    navigation: true,
  },
})

const http = useHttp()
const ui = useUi()
const options: OvTableOptions = {
  key: 'role',
  stateKey: 'admin.roles',
  search: { placeholder: 'admin.searchRoles' },
  columns: [
    { name: 'role', label: 'admin.role' },
    { name: 'description', label: 'admin.description' },
  ],
}

async function fetchRoles({ cursor, limit, search, signal, complete }: OvTableFetchRequest) {
  const result = await ui.action('admin.roles.list', async () => {
    const { data, error } = await http.get<components['schemas']['AdminListRolesResponse']>(
      '/admin/roles',
      { query: { cursor, limit, search }, signal },
    )
    if (signal.aborted) return
    if (error || !data) throw new Error('admin.loadRolesError')
    return data
  })
  complete(result.ok ? result.data : undefined)
}
</script>
