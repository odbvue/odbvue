<template>
  <v-ov-table :options="options" :data="data" :loading="loading" @fetch="fetch" @action="action" />
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Boards',
    description: 'Manage Travail boards',
    icon: '$mdiViewModule',
    visibility: 'always',
    access: 'when-authenticated',
  },
})

import type { OvFilterValue, OvTableData, OvTableOptions, OvFormData } from '@/components/index.ts'
import { useFormAction, useTableFetch } from '@/components/index.ts'
import { useTravailStore } from './travail.ts'

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

type BoardsResponse = {
  boards: OvTableData[]
}

type BoardRow = OvTableData & {
  key: string
  title: string
  description?: string
  settings?: BoardSettings
  settingsText?: string
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

const router = useRouter()
const travail = useTravailStore()

const data = ref<OvTableData[]>([])

const {
  loading,
  data: rawData,
  fetch: rawFetch,
} = useTableFetch<BoardsResponse>({
  endpoint: 'tra/boards/',
  responseKey: 'boards',
})

const normalizeRows = (rows: OvTableData[]): OvTableData[] => {
  return rows.map((row) => {
    const board = row as BoardRow
    const settingsText =
      typeof board.settingsText === 'string'
        ? board.settingsText
        : board.settings
          ? JSON.stringify(board.settings, null, 2)
          : DEFAULT_SETTINGS_TEXT
    return {
      ...row,
      settingsText,
    }
  })
}

async function fetch(
  fetchData: OvTableData[],
  offset: number,
  limit: number,
  search: string,
  filter: OvFilterValue,
  sort: string,
) {
  await rawFetch(fetchData, offset, limit, search, filter, sort)
  data.value = normalizeRows(rawData.value)
}

type PostBoardRequest = {
  data: string
}

const parseSettingsText = (settingsText: string): BoardSettings => {
  const parsed = JSON.parse(settingsText) as unknown
  return parsed as BoardSettings
}

const { action: formAction } = useFormAction({
  endpoints: {
    edit: 'tra/board/',
    add: 'tra/board/',
  },
  refetchOn: ['edit', 'add'],
  transformPayload: (_actionName: string, payload: OvFormData) => {
    const key = String(payload.key ?? '').trim()
    const title = String(payload.title ?? '').trim()
    const description = String(payload.description ?? '')
    const settingsText = String(payload.settingsText ?? '').trim()
    const settings = parseSettingsText(settingsText || DEFAULT_SETTINGS_TEXT)

    const boardPayload = {
      key,
      title,
      description,
      settings,
    }

    const request: PostBoardRequest = {
      data: encodeURIComponent(JSON.stringify(boardPayload)),
    }
    return request as unknown as OvFormData
  },
})

async function action(
  actionName: string,
  tableData: unknown,
  value?: unknown,
  callback?: (errors?: unknown[], shouldRefetch?: boolean) => void,
) {
  if (actionName === 'select') {
    const boardKey = String((value as BoardRow | undefined)?.key ?? '').trim()
    if (!boardKey) return
    await travail.setActiveBoard(boardKey)
    await router.push('/travail')
    return
  }

  await formAction(actionName, tableData as OvFormData, value as OvFormData, callback as never)
}

const options = ref<OvTableOptions>({
  key: 'key',
  columns: [
    { name: 'key' },
    { name: 'title' },
    { name: 'description', maxLength: 40 },
    { name: 'settingsText', label: 'settings', maxLength: 40 },
    {
      name: 'actions',
      label: '',
      actions: [
        {
          name: 'edit',
          format: { icon: '$mdiPencil' },
          form: {
            cols: 2,
            fields: [
              {
                type: 'text',
                name: 'key',
                label: 'key',
                disabled: true,
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
                rows: 3,
                autoGrow: true,
              },
              {
                type: 'textarea',
                name: 'settingsText',
                label: 'settings',
                rows: 12,
                autoGrow: true,
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
          },
        },
        {
          name: 'select',
          format: { icon: '$mdiCheck' },
        },
      ],
    },
  ],
  actions: [
    {
      name: 'add',
      format: { icon: '$mdiPlus' },
      form: {
        cols: 2,
        fields: [
          {
            type: 'text',
            name: 'key',
            label: 'key',
            rules: [{ type: 'required', params: true, message: 'required' }],
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
            rows: 3,
            autoGrow: true,
          },
          {
            type: 'textarea',
            name: 'settingsText',
            label: 'settings',
            value: DEFAULT_SETTINGS_TEXT,
            rows: 12,
            autoGrow: true,
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
      },
    },
  ],
  search: {
    label: 'search',
  },
  maxLength: 40,
})
</script>
