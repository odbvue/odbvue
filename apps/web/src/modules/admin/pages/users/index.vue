<template>
  <v-container>
    <v-alert v-if="error" type="error" :text="t(error)" class="mb-4" />
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
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHttp } from '@/capabilities/http'
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

type User = components['schemas']['AdminListUsersItemsItem']

const { t } = useI18n()
const http = useHttp()
const items = ref<User[]>([])
const nextCursor = ref<string>()
const loading = ref(false)
const loaded = ref(false)
const error = ref<string>()
let requestId = 0
let controller: AbortController | undefined

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
) {
  const currentRequest = ++requestId
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = undefined
  items.value = []
  nextCursor.value = undefined
  const response = await http.get<components['schemas']['AdminListUsersResponse']>('/admin/users', {
    query: { cursor, limit: limit + 1, search: search?.trim() || undefined },
    signal: controller.signal,
  })
  if (currentRequest !== requestId) return
  loading.value = false
  loaded.value = true
  if (response.error || !response.data) {
    error.value = 'admin.loadUsersError'
    return
  }
  items.value = response.data.items.slice(0, limit)
  nextCursor.value = response.data.items.length > limit ? items.value.at(-1)?.id : undefined
}

onBeforeUnmount(() => {
  requestId++
  controller?.abort()
})
</script>
