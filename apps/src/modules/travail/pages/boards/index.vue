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

import type { OvFilterValue, OvTableData, OvTableOptions } from '@/components/index.ts'
import { useTableFetch } from '@/components/index.ts'
import { useTravailStore } from '../travail.ts'

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

async function action(actionName: string, _tableData: unknown, value?: unknown) {
  if (actionName === 'select') {
    const boardKey = String((value as BoardRow | undefined)?.key ?? '').trim()
    if (!boardKey) return
    await travail.setActiveBoard(boardKey)
    await router.push('/travail')
    return
  }

  if (actionName === 'add') {
    await router.push('/travail/boards/new')
    return
  }

  if (actionName === 'edit') {
    const boardKey = String((value as BoardRow | undefined)?.key ?? '').trim()
    if (!boardKey) return
    await router.push(`/travail/boards/${boardKey}`)
    return
  }
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
    },
  ],
  search: {
    label: 'search',
  },
  maxLength: 40,
})
</script>
