<template>
  <v-container>
    <v-ov-view :data :options :loading="loading" @action="action" />
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'never',
    access: 'when-authenticated',
  },
})

const app = useAppStore()
const { loading, action } = useFormAction({
  endpoint: 'app/user/',
  refetchOn: ['edit-fullname'],
  transformPayload: (actionName, payload) => ({
    data: JSON.stringify({ fullname: payload.fullname }),
  }),
  onSuccess: (actionName, payload) => {
    if (actionName === 'edit-fullname') {
      useAppStore().user.fullname = payload.fullname as string
    }
  },
})

const data = computed(() => ({
  username: app.user.username,
  fullname: app.user.fullname,
  created: app.user.created,
  accessed: app.user.accessed,
}))

const options = ref<OvViewOptions>({
  items: [
    { name: 'username', label: 'username' },
    {
      name: 'fullname',
      label: 'fullname',
      actions: [
        {
          name: 'edit-fullname',
          format: { icon: '$mdiPencil', size: 'small' },
          form: {
            fields: [
              {
                name: 'fullname',
                label: 'fullname',
                type: 'text',
                rules: [{ type: 'required', params: true, message: 'required' }],
              },
            ],
            actions: [
              { name: 'save', format: { color: 'primary' } },
              { name: 'cancel', format: { color: 'secondary', variant: 'outlined' } },
            ],
            actionSubmit: 'save',
            actionCancel: 'cancel',
          },
        },
      ],
    },
    { name: 'created', label: 'created' },
    { name: 'accessed', label: 'accessed' },
  ],
})
</script>
