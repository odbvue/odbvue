<template>
  <v-ov-table :options :data :loading :t @fetch="fetch" @action="action" />
  <v-checkbox v-model="loading" label="Loading" class="ma-1" />
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'always',
    access: 'when-authenticated',
  },
})

const { t } = useI18n()

const loading = ref(false)
const data = ref<OvTableData[]>([])

import jsonData from './sandbox-table.json'

function action(actionName: string, actionData: OvTableData[], value?: OvTableData) {
  console.log('action', actionName, actionData, value)
  if (actionName == 'custom' && value && 'phone' in value)
    value.phone = Math.ceil(Math.random() * 100)
  if (actionName == 'delete' && value && 'status' in value) value.status = 'blocked'
  if (actionName === 'status-all') {
    const newStatus = value?.status
    if (!newStatus) return
    actionData.forEach((item) => {
      item.status = newStatus
    })
  }
}

async function fetch(
  fetchData: OvTableData[],
  offset: number,
  limit: number,
  search: string,
  filter: string,
  sort: string,
) {
  function filterValueToObject(filter: string) {
    const filterParts = filter.split(',')
    const filterObj: Record<string, string | string[]> = {}
    filterParts.forEach((part) => {
      const match = part.match(/([^[]+)\[([^\]]+)\]/)
      if (match && match[1] && match[2]) {
        const [, key, value] = match as RegExpExecArray & { [1]: string; [2]: string }
        if (value.includes(',')) {
          filterObj[key] = value.split(',')
        } else {
          filterObj[key] = value
        }
      }
    })
    return filterObj
  }

  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 1500))

  let newData = jsonData

  if (search)
    newData = newData.filter((item) =>
      Object.values(item).some((value) =>
        String(value).toLowerCase().includes(search.toLowerCase()),
      ),
    )

  if (filter) {
    const filterObj = filterValueToObject(filter)
    newData = newData.filter((item) =>
      Object.entries(filterObj).every(([key, value]) => {
        const itemValue = item[key as keyof typeof item]
        return Array.isArray(value)
          ? value.includes(itemValue as string)
          : String(itemValue).toLowerCase().includes(String(value).toLowerCase())
      }),
    )
  }

  if (sort) {
    const sortArr = sort.split(',')
    newData = newData.sort((a, b) => {
      for (const sortItem of sortArr) {
        const sortKey = (sortItem.startsWith('-') ? sortItem.slice(1) : sortItem) as keyof typeof a
        const sortDir = sortItem.startsWith('-') ? -1 : 1
        if (a[sortKey] < b[sortKey]) return -sortDir
        if (a[sortKey] > b[sortKey]) return sortDir
      }
      return 0
    })
  }

  newData = newData.slice(offset, offset + limit)
  data.value = newData
  console.log('fetch', data.value)
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
