<template>
  <v-ov-view :options="options" :data="user" />
  <v-card
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

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import type { OvViewOptions } from '@/components/api'

definePage({
  meta: {
    title: 'admin.userDetails',
    access: ['admin'],
    navigation: false,
  },
})

const props = defineProps<{
  user: components['schemas']['AdminGetUserItemsItem']
  isSelf: boolean
}>()
const emit = defineEmits<{ 'update:enabled': [enabled: boolean] }>()
const { t } = useI18n()
const http = useHttp()
const ui = useUi()
const busy = computed(() => ui.loading.has('admin.users.status'))

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
  if (busy.value) return
  if (!enabled && props.isSelf) return ui.error('admin.cannotDisableSelf')
  await ui.action('admin.users.status', async () => {
    await http.putOrThrow(`/admin/users/${encodeURIComponent(props.user.id)}/status`, { enabled })
    emit('update:enabled', enabled)
    ui.success(enabled ? 'admin.userEnabled' : 'admin.userDisabled')
  })
}
</script>
