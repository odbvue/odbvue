<template>
  <v-ov-form
    :options="formOptions"
    :data="formData"
    :loading="loading"
    @submit="save"
    @cancel="cancel"
  />
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Board',
    visibility: 'always',
    access: 'when-authenticated',
  },
})

import type { OvFormData, OvFormOptions } from '@/components/index.ts'
import { useRouteParams } from '@/stores/app/navigation'

const router = useRouter()
const { param } = useRouteParams()
const key = param('key')
const isNew = computed(() => key.value === 'new')

import { useTravailStore } from '../travail'
const travail = useTravailStore()

type BoardSettings = {
  due_warn_before_days: number
  statuses: Array<{
    value: string
    title: string
    attrs: {
      format: {
        color: string
      }
    }
  }>
  priorities: Array<{
    value: string
    title: string
    attrs: {
      format: {
        color: string
      }
    }
  }>
  units?: string
}

const DEFAULT_SETTINGS_TEXT = `{
"due_warn_before_days":5,
"statuses": [
    {"value": "todo", "title": "To Do", "attrs": {"format": {"color": "warning"}}},
    {"value": "doing", "title": "In Progress", "attrs": {"format": {"color": "info"}}},
    {"value": "done", "title": "Done", "attrs": {"format": {"color": "success"}}}
],
"priorities": [
    {"value": "attention", "title": "Attention", "attrs": {"format": {"color": "warning"}}},
    {"value": "high", "title": "High", "attrs": {"format": {"color": "error"}}}
],
"units":"days"
}`

const loading = ref(false)
const formData = ref<OvFormData>({
  key: '',
  title: '',
  description: '',
  settingsText: DEFAULT_SETTINGS_TEXT,
})

onMounted(async () => {
  useNavigationStore().breadcrumb = isNew.value ? 'New' : key.value

  if (!isNew.value) {
    loading.value = true
    try {
      const board = await travail.getBoard(key.value)
      formData.value = board || {}
    } finally {
      loading.value = false
    }
  }
})

onUnmounted(() => {
  useNavigationStore().breadcrumb = ''
})

const parseSettingsText = (settingsText: string): BoardSettings => {
  const parsed = JSON.parse(settingsText) as unknown
  return parsed as BoardSettings
}

const errors = ref<OvFormFieldError[]>([])

async function save(actionData: OvFormData) {
  loading.value = true
  try {
    const keyValue = String(actionData.key ?? '').trim()
    const title = String(actionData.title ?? '').trim()
    const description = String(actionData.description ?? '')
    const settingsText = String(actionData.settingsText ?? '').trim()
    const settings = parseSettingsText(settingsText || DEFAULT_SETTINGS_TEXT)

    const boardPayload = {
      key: keyValue,
      title,
      description,
      settings,
    }

    const { data } = await travail.postBoard(boardPayload)
    if (data && data.errors) errors.value = data.errors
    else {
      errors.value = []
      await router.push('/travail/boards')
    }
  } finally {
    loading.value = false
  }
}

async function cancel() {
  await router.push('/travail/boards')
}

const formOptions = computed<OvFormOptions>(() => ({
  cols: 2,
  fields: [
    {
      type: 'text',
      name: 'key',
      label: 'key',
      disabled: !isNew.value,
      rules: isNew.value ? [{ type: 'required', params: true, message: 'required' }] : [],
    },
    {
      type: 'text',
      name: 'title',
      label: 'title',
      rules: [{ type: 'required', params: true, message: 'required' }],
    },
    {
      type: 'textarea',
      name: 'description',
      label: 'description',
      rows: 4,
      autoGrow: true,
    },
    {
      type: 'textarea',
      name: 'settingsText',
      label: 'settings',
      value: isNew.value ? DEFAULT_SETTINGS_TEXT : undefined,
      rows: 4,
      rules: [
        { type: 'required', params: true, message: 'required' },
        { type: 'is-json', params: true, message: 'invalid.json' },
      ],
    },
  ],
  actions: [
    { name: 'save' },
    { name: 'cancel', format: { color: 'secondary', variant: 'outlined' } },
  ],
  actionSubmit: 'save',
  actionCancel: 'cancel',
  focusFirst: true,
  errors: errors.value,
}))
</script>
