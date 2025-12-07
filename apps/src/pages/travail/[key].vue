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
const routeParamValue = (name: string) => {
  const route = useRoute()
  const param = (route.params as Record<string, unknown>)[name]
  return Array.isArray(param) ? param[0] : param || ''
}
const routeQueryValue = (name: string) => {
  const route = useRoute()
  const query = route.query[name]
  return Array.isArray(query) ? query[0] : query || ''
}

const key = ref(routeParamValue('key'))
const parentKey = ref(routeQueryValue('parent-key'))

import { useTravailStore } from './travail.ts'
const travail = useTravailStore()
const router = useRouter()
const app = useAppStore()

onMounted(async () => {
  if (key.value) {
    app.ui.startLoading()
    const task = await travail.getTask(key.value)
    app.ui.stopLoading()
    taskData.value = task || {}
  }
})

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
      name: 'parent-key',
      hidden: true,
      value: taskData.value['parent-key'] || parentKey.value || '',
    },
    {
      type: 'text',
      name: 'key',
      label: 'key',
      hidden: key.value !== 'new-task' || parentKey.value !== '',
    },
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
