<template>
  <v-ov-table
    :options="options"
    :data="data"
    :loading="loading"
    @fetch="fetchSettings"
    @action="actionSettings"
  ></v-ov-table>
</template>
<script setup lang="ts">
definePage({
  meta: {
    title: 'Settings',
    description: 'Manage application settings',
    icon: '$mdiCog',
    color: '#FFDDDD',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const {
  loading,
  data,
  fetch: fetchSettings,
} = useTableFetch({
  endpoint: 'adm/settings/',
  responseKey: 'settings',
})

const { action: actionSettings } = useFormAction({
  endpoint: 'adm/setting/',
})

const options = ref<OvTableOptions>({
  key: 'id',
  columns: [
    { name: 'id' },
    { name: 'name' },
    { name: 'value' },
    {
      name: 'edit',
      actions: [
        {
          name: 'edit',
          key: 'id',
          format: { icon: '$mdiPencil' },
          form: {
            fields: [{ name: 'value', type: 'text', label: 'value' }],
            actions: [
              { name: 'save' },
              { name: 'cancel', format: { color: 'secondary', variant: 'outlined' } },
            ],
            actionSubmit: 'save',
            actionCancel: 'cancel',
          },
        },
      ],
    },
  ],
  search: {
    label: 'search',
  },

  maxLength: 30,
})
</script>
