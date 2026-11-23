<template>
  <v-container>
    <v-ov-table
      :options="options"
      :loading="saving"
      title="admin.settings"
      description="admin.settingsDescription"
      @fetch="fetchSettings"
      @action="saveSetting"
    />
  </v-container>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import { isRecord, settingField } from './metadata'
import type { components } from '@/api/openapi.generated'
import type {
  OvFormFieldError,
  OvFormOptions,
  OvTableFetchRequest,
  OvTableOptions,
} from '@/components/api'

definePage({
  meta: {
    title: 'admin.settings',
    icon: '$mdiCog',
    access: ['admin'],
    navigation: true,
  },
})

const http = useHttp()
const ui = useUi()
const saving = ref(false)

const editForm = (field: OvFormOptions['fields'][number]): OvFormOptions => ({
  fields: [{ name: 'id', type: 'text', label: 'admin.settingId', readonly: true }, field],
  actions: ['admin.cancel', { name: 'admin.saveSetting', format: { color: 'primary' } }],
  actionCancel: 'admin.cancel',
  actionSubmit: 'admin.saveSetting',
})

const options = computed<OvTableOptions>(() => ({
  key: 'id',
  stateKey: 'admin.settings',
  search: { placeholder: 'admin.searchSettings' },
  columns: [
    { name: 'id', label: 'admin.settingId' },
    { name: 'value', label: 'admin.settingValue', maxLength: 30 },
    {
      name: 'secret',
      label: 'admin.settingSecret',
      format: [
        { rules: { type: 'equals', params: 'Y' }, icon: '$mdiLock', text: '' },
        { text: '' },
      ],
    },
    {
      name: 'actions',
      label: 'admin.roleActions',
      actions: [
        {
          name: 'admin.editSetting',
          title: 'admin.editSetting',
          key: 'editMode',
          format: [
            { rules: { type: 'equals', params: 'value' }, icon: '$mdiPencil' },
            { hidden: true },
          ],
          form: (row) => editForm(settingField(row.meta, false)),
        },
        {
          name: 'admin.replaceSettingSecret',
          title: 'admin.replaceSettingSecret',
          key: 'editMode',
          format: [
            { rules: { type: 'equals', params: 'secret' }, icon: '$mdiPencil' },
            { hidden: true },
          ],
          form: (row) => editForm(settingField(row.meta, true)),
        },
      ],
    },
  ],
}))

async function fetchSettings({ cursor, limit, search, signal, complete }: OvTableFetchRequest) {
  const result = await ui.action('admin.settings.list', async () => {
    const { data, error } = await http.get<components['schemas']['AdminListSettingsResponse']>(
      '/admin/settings',
      { query: { cursor, limit, search }, signal },
    )
    if (signal.aborted) return
    if (error || !data) throw new Error('admin.loadSettingsError')
    return {
      ...data,
      items: data.items.map((row) => {
        settingField(row.meta, row.secret === 'Y')
        const editable = row.readonly === 'N' ? row.secret : undefined
        return {
          ...row,
          editMode: editable === 'N' ? 'value' : editable === 'Y' ? 'secret' : 'none',
        }
      }),
    }
  })
  if (!result.ok || !result.data) return complete()
  complete(result.data)
}

async function saveSetting(
  action: string,
  _rows: unknown,
  submission?: unknown,
  complete?: (errors?: OvFormFieldError[], refetch?: boolean) => void,
) {
  if (
    (action !== 'admin.replaceSettingSecret' && action !== 'admin.editSetting') ||
    saving.value ||
    !complete
  )
    return
  if (!isRecord(submission) || typeof submission.id !== 'string') {
    return complete([{ name: 'value', message: 'admin.updateSettingError' }])
  }
  const { id, value } = submission
  saving.value = true
  const result = await ui.action('admin.settings.update', async () => {
    const { error } = await http.put(`/admin/settings/${encodeURIComponent(id)}`, { value })
    if (error) throw new Error('admin.updateSettingError')
  })
  saving.value = false
  await nextTick()
  if (result.ok) {
    complete(undefined, true)
    ui.success('admin.settingSaved')
  }
}
</script>
