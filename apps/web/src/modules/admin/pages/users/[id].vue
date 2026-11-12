<template>
  <v-container>
    <v-alert v-if="error" type="error" :text="t(error)" class="mb-4" />
    <v-progress-linear v-if="loading" indeterminate :aria-label="t('admin.loadingUser')" />
    <h3 v-if="user">{{ user.username }}</h3>
    <v-tabs v-model="tab">
      <v-tab value="details">{{ t('admin.details') }}</v-tab>
    </v-tabs>
    <v-tabs-window v-model="tab">
      <v-tabs-window-item value="details">
        <template v-if="user">
          <v-ov-view :key="user.id" :options="options" :data="user" />
        </template>
      </v-tabs-window-item>
    </v-tabs-window>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHttp } from '@/capabilities/http'
import { computedRouteParam, useRouting } from '@/capabilities/routing'
import type { components } from '@/api/openapi.generated'
import type { OvViewOptions } from '@/components/api'

definePage({
  meta: {
    title: 'admin.userDetails',
    icon: '$mdiAccount',
    access: ['admin'],
    navigation: false,
  },
})

const { t } = useI18n()
const http = useHttp()
const routing = useRouting()
const tab = ref('details')
const id = computedRouteParam(useRoute(), 'id')
const user = ref<components['schemas']['AdminGetUserItemsItem']>()
const loading = ref(false)
const error = ref<string>()
watch(
  user,
  (value) => routing.setBreadcrumb(value ? value.displayName?.trim() || value.username : undefined),
  { immediate: true },
)
onBeforeUnmount(() => routing.setBreadcrumb())

const options = computed<OvViewOptions>(() => ({
  cols: 2,
  items: [
    { name: 'id', label: t('admin.userId') },
    { name: 'username', label: t('admin.username') },
    { name: 'displayName', label: t('admin.displayName') },
    {
      name: 'enabled',
      label: t('admin.status'),
      format: [
        {
          rules: { type: 'equals', params: 'true' },
          text: t('admin.enabled'),
          color: 'success',
        },
        { text: t('admin.disabled'), color: 'warning' },
      ],
    },
    { name: 'createdAt', label: t('admin.createdAt'), format: { tsFormat: 'datetime' } },
    { name: 'updatedAt', label: t('admin.updatedAt'), format: { tsFormat: 'datetime' } },
  ],
}))

watch(
  id,
  async (value, _previous, onCleanup) => {
    const controller = new AbortController()
    let active = true
    onCleanup(() => {
      active = false
      controller.abort()
    })
    loading.value = true
    user.value = undefined
    error.value = undefined
    const response = await http.get<components['schemas']['AdminGetUserResponse']>(
      `/admin/users/${encodeURIComponent(value)}`,
      { signal: controller.signal },
    )
    if (!active) return
    loading.value = false
    if (response.error || !response.data) {
      error.value = response.status === 404 ? 'admin.userNotFound' : 'admin.loadUserError'
      return
    }
    user.value = response.data.items[0]
    if (!user.value) error.value = 'admin.userNotFound'
  },
  { immediate: true },
)
</script>
