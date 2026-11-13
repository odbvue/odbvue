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
              <v-btn
                v-if="user.enabled"
                color="warning"
                :disabled="busy || isSelf"
              >
                {{ t('admin.disableUser') }}
                <v-ov-dialog
                  activator="parent"
                  :title="t('admin.confirmDisableUser')"
                  :content="t('admin.disableConfirmation', { username: user.username })"
                  :actions="['admin.cancel', { name: 'admin.disableUser', format: { color: 'warning' } }]"
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
import { computed, onScopeDispose, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/capabilities/auth'
import { useFetch, useFormAction } from '@/capabilities/http'
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
const auth = useAuth()
const routing = useRouting()
const ui = useUi()
const tab = ref('details')
const id = computedRouteParam(useRoute(), 'id')
const selectUser = (response: components['schemas']['AdminGetUserResponse']) => response.items[0]
const { data: user, loading } = useFetch({
  endpoint: () => `/admin/users/${encodeURIComponent(id.value)}`,
  select: selectUser,
  loadingKey: 'admin.users.details',
  messages: {
    error: 'admin.loadUserError',
    notFound: 'admin.userNotFound',
    empty: 'admin.userNotFound',
  },
})
const { action: setEnabled, loading: saving } = useFormAction({
  endpoint: () => `/admin/users/${encodeURIComponent(id.value)}/status`,
  method: 'put',
  transformPayload: (enabled: boolean) => ({ enabled }),
  select: selectUser,
  loadingKey: 'admin.users.status',
  messages: {
    error: 'admin.statusUpdateError',
    notFound: 'admin.userNotFound',
    success: (_user, enabled) => enabled ? 'admin.userEnabled' : 'admin.userDisabled',
  },
  onSuccess: (updated) => { user.value = updated },
})
const isSelf = computed(() => user.value?.id === auth.user.value?.id)
const busy = computed(() => loading.value || saving.value)
watchEffect(() =>
  routing.setBreadcrumb(user.value?.displayName?.trim() || user.value?.username),
)

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

onScopeDispose(() => {
  routing.setBreadcrumb()
  ui.clear()
})
</script>
