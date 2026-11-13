<template>
  <v-container>
    <h3 v-if="user">{{ user.username }}</h3>
    <v-tabs v-model="tab">
      <v-tab value="details">{{ t('admin.details') }}</v-tab>
    </v-tabs>
    <v-tabs-window v-model="tab">
      <v-tabs-window-item value="details">
        <template v-if="user">
          <v-ov-view :key="user.id" :options="options" :data="user" />
          <v-card
            :key="user.id"
            variant="flat"
            :title="t('admin.accountAccess')"
            :subtitle="t(user.enabled ? 'admin.disableDescription' : 'admin.enableDescription')"
            :text="user.enabled && isSelf ? t('admin.cannotDisableSelf') : undefined"
          >
            <v-card-actions>
              <v-btn v-if="user.enabled" color="warning" :disabled="busy || isSelf">
                {{ t('admin.disableUser') }}
                <v-ov-dialog
                  activator="parent"
                  :title="t('admin.confirmDisableUser')"
                  :content="t('admin.disableConfirmation', { username: user.username })"
                  :actions="[
                    'admin.cancel',
                    { name: 'admin.disableUser', format: { color: 'warning' } },
                  ]"
                  action-cancel="admin.cancel"
                  action-submit="admin.disableUser"
                  max-width="480"
                  @submit="setEnabled(false)"
                />
              </v-btn>
              <v-btn v-else color="success" :disabled="busy" @click="setEnabled(true)">
                {{ t('admin.enableUser') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </template>
      </v-tabs-window-item>
    </v-tabs-window>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/capabilities/auth'
import { useHttp } from '@/capabilities/http'
import { computedRouteParam, useRouting } from '@/capabilities/routing'
import { useUi } from '@/capabilities/ui'
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
const auth = useAuth()
const routing = useRouting()
const ui = useUi()
const tab = ref('details')
const id = computedRouteParam(useRoute(), 'id')
const user = ref<components['schemas']['AdminGetUserItemsItem']>()
const isSelf = computed(() => user.value?.id === auth.user.value?.id)
const busy = computed(() => ui.loading.has('admin.users'))
watchEffect(() => routing.setBreadcrumb(user.value?.displayName?.trim() || user.value?.username))

onMounted(() => {
  void ui.run('admin.users.details', async () => {
    const { data, error, status } = await http.get<components['schemas']['AdminGetUserResponse']>(
      `/admin/users/${encodeURIComponent(id.value)}`,
    )
    if (error) throw new Error(status === 404 ? 'admin.userNotFound' : 'admin.loadUserError')
    user.value = data?.items[0]
    if (!user.value) throw new Error('admin.userNotFound')
  })
})

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

async function setEnabled(enabled: boolean) {
  const account = user.value
  if (!account || busy.value) return
  if (!enabled && isSelf.value) return ui.error('admin.cannotDisableSelf')
  await ui.run('admin.users.status', async () => {
    await http.putOrThrow(`/admin/users/${encodeURIComponent(account.id)}/status`, { enabled })
    account.enabled = enabled
    ui.success(enabled ? 'admin.userEnabled' : 'admin.userDisabled')
  })
}

onUnmounted(() => {
  routing.setBreadcrumb()
})
</script>
