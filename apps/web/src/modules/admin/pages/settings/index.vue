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
import { settingField } from './metadata'
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

const maxValueLength = 2000
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
        if (row.readonly === 'N') {
          if (row.secret === 'N') return { ...row, editMode: 'value' }
          if (row.secret === 'Y') return { ...row, editMode: 'secret' }
        }
        return { ...row, editMode: 'none' }
      }),
    }
  })
  if (!result.ok || !result.data) return complete()
  complete(result.data)
}

async function saveSetting(
  action: string,
  rows: unknown,
  submission?: unknown,
  complete?: (errors?: OvFormFieldError[], refetch?: boolean) => void,
) {
  const secret = action === 'admin.replaceSettingSecret'
  if ((!secret && action !== 'admin.editSetting') || saving.value || !complete) return
  const field = secret ? 'replacement' : 'value'
  if (
    !submission ||
    typeof submission !== 'object' ||
    !('id' in submission) ||
    typeof submission.id !== 'string' ||
    !Array.isArray(rows)
  ) {
    return complete([{ name: field, message: 'admin.updateSettingError' }])
  }
  const { id } = submission
  const row: unknown = rows.find(
    (candidate: unknown) =>
      candidate && typeof candidate === 'object' && 'id' in candidate && candidate.id === id,
  )
  if (
    !row ||
    typeof row !== 'object' ||
    !('readonly' in row) ||
    row.readonly !== 'N' ||
    !('secret' in row) ||
    row.secret !== (secret ? 'Y' : 'N')
  ) {
    return complete([{ name: field, message: 'admin.settingTrustedSetup' }])
  }
  const input = secret
    ? 'replacement' in submission
      ? submission.replacement
      : undefined
    : 'value' in submission
      ? submission.value
      : undefined
  const isSwitch =
    'meta' in row &&
    row.meta !== null &&
    typeof row.meta === 'object' &&
    'type' in row.meta &&
    (row.meta.type === 'switch' || row.meta.type === 'checkbox')
  const value = typeof input === 'boolean' && isSwitch ? (input ? 'Y' : 'N') : (input ?? '')
  if (typeof value !== 'string') {
    return complete([{ name: field, message: 'admin.updateSettingError' }])
  }
  if (secret && (!value || value === '********')) {
    return complete([{ name: field, message: 'admin.settingSecretRequired' }])
  }
  if (value.length > maxValueLength) {
    return complete([{ name: field, message: 'admin.settingTooLong' }])
  }
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
