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
            variant="flat"
            :title="t('admin.accountAccess')"
            :subtitle="t(user.enabled ? 'admin.disableDescription' : 'admin.enableDescription')"
            :text="user.enabled && isSelf ? t('admin.cannotDisableSelf') : undefined"
          >
            <v-card-actions>
              <v-btn
                :color="user.enabled ? 'warning' : 'success'"
                :disabled="busy || (user.enabled && isSelf)"
                @click="user.enabled ? (confirmingDisable = true) : setEnabled(true)"
              >
                {{ t(user.enabled ? 'admin.disableUser' : 'admin.enableUser') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </template>
      </v-tabs-window-item>
    </v-tabs-window>
    <v-ov-dialog
      v-if="user"
      v-model="confirmingDisable"
      :title="t('admin.confirmDisableUser')"
      :content="t('admin.disableConfirmation', { username: user.username })"
      :actions="['admin.cancel', { name: 'admin.disableUser', format: { color: 'warning' } }]"
      action-cancel="admin.cancel"
      action-submit="admin.disableUser"
      max-width="480"
      @submit="setEnabled(false)"
    />
  </v-container>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/capabilities/auth'
import { useHttp, useMutation } from '@/capabilities/http'
import { computedRouteParam, useRouting } from '@/capabilities/routing'
import { useUi } from '@/capabilities/ui'
import type { components, operations } from '@/api/openapi.generated'
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
const confirmingDisable = ref(false)
const isSelf = computed(() => user.value?.id === auth.user.value?.id)
const busy = computed(
  () => ui.loading.has('admin.users.details') || ui.loading.has('admin.users.status'),
)
const { mutate, reset } = useMutation({
  loadingKey: 'admin.users.status',
  request: ({ id: userId, enabled }: { id: string; enabled: boolean }, { signal }) =>
    http.put<components['schemas']['AdminSetUserEnabledResponse']>(
      `/admin/users/${encodeURIComponent(userId)}/status`,
      { enabled } satisfies NonNullable<
        operations['admin_set_user_enabled']['requestBody']
      >['content']['application/json'],
      { signal },
    ),
  onSuccess: (data, { enabled }) => {
    const updated = data?.items[0]
    if (!updated) throw new Error('User status response has no user')
    user.value = updated
    ui.success(enabled ? 'admin.userEnabled' : 'admin.userDisabled')
  },
  onError: (cause) => ui.error(errorMessage(cause, 'admin.statusUpdateError')),
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

function setEnabled(enabled: boolean) {
  confirmingDisable.value = false
  if (!user.value || busy.value) return
  if (!enabled && isSelf.value) {
    ui.error('admin.cannotDisableSelf')
    return
  }
  ui.clear()
  return mutate({ id: user.value.id, enabled })
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && 'status' in cause && cause.status === 404
    ? 'admin.userNotFound'
    : fallback
}

watch(
  id,
  async (value, _previous, onCleanup) => {
    const controller = new AbortController()
    const stopLoading = ui.loading.start('admin.users.details')
    onCleanup(() => {
      controller.abort()
      reset()
      stopLoading()
    })
    confirmingDisable.value = false
    ui.clear()
    user.value = undefined
    routing.setBreadcrumb()
    try {
      const response = await http.get<components['schemas']['AdminGetUserResponse']>(
        `/admin/users/${encodeURIComponent(value)}`,
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      if (response.error || !response.data) {
        ui.error(response.status === 404 ? 'admin.userNotFound' : 'admin.loadUserError')
        return
      }
      user.value = response.data.items[0]
      if (!user.value) ui.error('admin.userNotFound')
      else routing.setBreadcrumb(user.value.displayName?.trim() || user.value.username)
    } catch (cause) {
      if (!controller.signal.aborted) ui.error(errorMessage(cause, 'admin.loadUserError'))
    } finally {
      stopLoading()
    }
  },
  { immediate: true },
)

onScopeDispose(() => {
  routing.setBreadcrumb()
  ui.clear()
})
</script>
