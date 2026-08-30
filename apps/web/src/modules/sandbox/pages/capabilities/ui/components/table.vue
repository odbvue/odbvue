<template>
  <v-ov-table
    :options
    :items="data"
    :loading
    :next-cursor="nextCursor"
    @fetch="fetch"
    @action="action"
  />
  <v-checkbox v-model="loading" label="Loading" class="ma-1" />
</template>

<script setup lang="ts">
import type { OvFilterValue, OvTableData, OvTableOptions } from '@odbvue/web/components'

definePage({
  meta: {
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const loading = ref(false)
const data = ref<OvTableData[]>([])
const nextCursor = ref<string | undefined>(undefined)

import jsonData from './table.json'

function action(actionName: string, actionData: unknown, value?: unknown) {
  const rows = (Array.isArray(actionData) ? actionData : []) as OvTableData[]
  const rowValue = value as OvTableData | undefined

  console.log('action', actionName, rows, rowValue)
  if (actionName == 'custom' && rowValue && 'phone' in rowValue)
    rowValue.phone = Math.ceil(Math.random() * 100)
  if (actionName == 'delete' && rowValue && 'status' in rowValue) rowValue.status = 'blocked'
  if (actionName === 'status-all') {
    const newStatus = rowValue?.status
    if (!newStatus) return
    rows.forEach((item) => {
      item.status = newStatus
    })
  }
}

async function fetch(
  _items: OvTableData[],
  cursor: string | undefined,
  limit: number,
  search?: string,
  filter?: OvFilterValue,
  sort?: string,
) {
  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 1500))

  let newData = jsonData

  if (search)
    newData = newData.filter((item) =>
      Object.values(item).some((value) =>
        String(value).toLowerCase().includes(search.toLowerCase()),
      ),
    )

  if (filter && Object.keys(filter).length > 0) {
    newData = newData.filter((item) =>
      Object.entries(filter).every(([key, value]) => {
        const itemValue = item[key as keyof typeof item]
        return Array.isArray(value)
          ? value.includes(itemValue as string)
          : String(itemValue).toLowerCase().includes(String(value).toLowerCase())
      }),
    )
  }

  if (sort) {
    const sortArr = sort.split(',')
    newData = [...newData].toSorted((a, b) => {
      for (const sortItem of sortArr) {
        const sortKey = (sortItem.startsWith('-') ? sortItem.slice(1) : sortItem) as keyof typeof a
        const sortDir = sortItem.startsWith('-') ? -1 : 1
        if (a[sortKey] < b[sortKey]) return -sortDir
        if (a[sortKey] > b[sortKey]) return sortDir
      }
      return 0
    })
  }

  const start = cursor ? Number(cursor) : 0
  const pageItems = newData.slice(start, start + limit)
  data.value = pageItems
  nextCursor.value = start + pageItems.length < newData.length ? String(start + limit) : undefined
  console.log('fetch', data.value, nextCursor.value)
  loading.value = false
}

const options = ref<OvTableOptions>({
  key: 'name',
  columns: [
    { name: 'name' },
    {
      name: 'email',
      format: {
        icon: '$mdiEmail',
        href: 'mailto:{{value}}',
        target: '_blank',
      },
    },
    { name: 'phone', maxLength: 0 },
    { name: 'website', format: { text: 'site' }, maxLength: 20 },
    {
      name: 'status',
      format: [
        {
          rules: { type: 'starts-with', params: 'active' },
          color: 'green',
        },
        { color: 'red' },
      ],
      align: 'center',
    },
    {
      name: 'actions',
      align: 'right',
      actions: [
        {
          name: 'edit',
          format: { icon: '$mdiPencil' },
          form: {
            fields: [
              {
                type: 'text',
                name: 'name',
                label: 'name',
                rules: [{ type: 'required', params: true, message: 'required' }],
              },
              { type: 'text', name: 'email', label: 'email' },
              { type: 'text', name: 'phone', label: 'phone' },
              { type: 'text', name: 'website', label: 'website' },
              { type: 'select', name: 'status', label: 'status', items: ['active', 'blocked'] },
            ],
            actions: [
              { name: 'edit', format: { text: 'submit' } },
              {
                name: 'cancel',
                format: { variant: 'outlined', text: 'cancel', color: 'lime' },
              },
            ],
            actionFormat: {
              color: 'lime',
            },
            actionAlign: 'center',
            actionSubmit: 'edit',
            actionCancel: 'cancel',
            cols: 2,
            autocomplete: 'off',
            focusFirst: true,
          },
        },
        {
          name: 'delete',
          key: 'status',
          format: [
            {
              rules: { type: 'starts-with', params: 'active' },
              icon: '$mdiDelete',
              color: 'red',
            },
            { hidden: true },
          ],
        },
      ],
    },
  ],
  actions: [
    { name: 'add', format: { icon: '$mdiPlus' } },
    {
      name: 'status-all',
      format: { icon: '$mdiListStatus' },
      form: {
        fields: [
          {
            type: 'select',
            name: 'status',
            label: 'status',
            items: ['active', 'blocked'],
            rules: [{ type: 'required', params: true, message: 'required' }],
          },
        ],
        actions: [
          { name: 'status', format: { text: 'submit' } },
          {
            name: 'cancel',
            format: { variant: 'outlined', text: 'cancel', color: 'lime' },
          },
        ],
        actionSubmit: 'status',
        actionCancel: 'cancel',
      },
    },
  ],
  actionFormat: {},
  search: {
    value: 'a',
    label: 'search',
    placeholder: '',
  },
  filter: {
    fields: [
      { type: 'text', name: 'phone', label: 'phone' },
      {
        type: 'select',
        name: 'status',
        label: 'status',
        value: ['active', 'blocked'],
        items: ['active', 'blocked'],
        multiple: true,
      },
    ],
    actions: [{ name: 'custom' }],
    cols: 2,
  },
  sort: [
    { name: 'name', value: 'asc' },
    { name: 'phone', label: 'Phone' },
    { name: 'status', value: 'desc' },
  ],
  maxLength: 40,
})
</script>
