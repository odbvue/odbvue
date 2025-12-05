<template>
  <v-container>
    {{ key }}

    <v-ov-form :data="taskData" :options="taskOptions" @submit="createTask" />
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Task Details',
    description: 'Details of a specific task',
    icon: '$mdiBee',
    color: '#FFC107',
    visibility: 'always',
    access: 'when-authenticated',
  },
})

import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const key =
  'key' in route.params
    ? Array.isArray(route.params.key)
      ? route.params.key[0]
      : route.params.key
    : ''

import { useTravailStore } from './travail.ts'
const travail = useTravailStore()
const router = useRouter()
const app = useAppStore()

const createTask = async (task: OvFormData) => {
  app.ui.startLoading()
  await travail.createTask(task)
  app.ui.stopLoading()
  router.push('/travail')
}

const taskData = ref<OvFormData>({})
const taskOptions = ref<OvFormOptions>({
  fields: [
    {
      type: 'text',
      name: 'title',
      label: 'title',
    },
    {
      type: 'textarea',
      name: 'description',
      label: 'description',
    },
  ],
  actions: [{ name: 'submit' }],
  actionSubmit: 'submit',
})
</script>
