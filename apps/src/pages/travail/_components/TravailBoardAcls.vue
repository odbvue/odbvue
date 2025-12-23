<template>
  <v-ov-table :data :options :loading @fetch="fetch" @action="action" />
</template>

<script setup lang="ts">
const props = defineProps<{
  boardKey: string
}>()

const { loading, data, fetch } = useTableFetch({
  endpoint: 'tra/acls/',
  responseKey: 'acls',
  filter: { board_key: [props.boardKey] },
})

const roles = ref<string[]>([])

interface RolesResponse {
  roles: { role: string }[]
}

onMounted(async () => {
  const { data } = await useHttp().get<RolesResponse>('adm/roles/', {
    params: { offset: 0, limit: 100 },
  })
  roles.value = data?.roles ? data.roles.map((r) => r.role) : []
})

const { action } = useFormAction({
  endpoints: {
    insert: 'tra/acl-add/',
    remove: 'tra/acl-remove/',
  },
  refetchOn: ['insert', 'remove'],
})

const options = computed<OvTableOptions>(() => ({
  key: 'board',
  search: { placeholder: 'board' },
  itemsPerPage: 5,
  columns: [
    { name: 'board' },
    { name: 'title' },
    { name: 'role' },
    {
      name: 'actions',
      actions: [
        {
          name: 'remove',
          format: { icon: '$mdiDelete', color: 'error' },
        },
      ],
    },
  ],
  actions: [
    {
      name: 'insert',
      format: { icon: '$mdiPlus' },
      form: {
        fields: [
          { type: 'text', name: 'board', label: 'board', disabled: true, value: props.boardKey },
          {
            name: 'role',
            label: 'role',
            type: 'autocomplete',
            items: roles.value,
          },
        ],
        actions: [{ name: 'add' }, { name: 'cancel', format: { variant: 'outlined' } }],
        actionSubmit: 'add',
        actionCancel: 'cancel',
      },
    },
  ],
}))
</script>
