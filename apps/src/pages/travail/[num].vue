<template>
  <v-container>
    <v-ov-view
      v-if="num != 'new-task'"
      :data="{ num }"
      :options="{ items: [{ name: 'num', label: 'key' }] }"
    />
    <v-ov-view
      v-if="parentNum"
      :data="{ num: parentNum }"
      :options="{ items: [{ name: 'num', label: 'parent.key' }] }"
    />

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

const num = ref(routeParamValue('num'))
const parentNum = ref(routeQueryValue('parent-num'))

import { useTravailStore } from './travail.ts'
const travail = useTravailStore()
const router = useRouter()

onMounted(async () => {
  if (num.value) {
    const task = await travail.getTask(num.value)
    taskData.value = task || {}
  }
})

const createTask = async (task: OvFormData) => {
  await travail.createTask(task)
  router.push('/travail')
}

const taskData = ref<OvFormData>({})
const taskOptions = ref<OvFormOptions>({
  fields: [
    {
      type: 'text',
      name: 'parent-num',
      value: parentNum.value || '',
      hidden: true,
    },
    {
      type: 'text',
      name: 'num',
      value: num.value || '',
      hidden: true,
    },
    {
      type: 'text',
      name: 'title',
      label: 'title',
    },
    {
      type: 'markdown',
      name: 'description',
      label: 'description',
      minHeight: '200px',
      maxHeight: '200px',
    },
    {
      type: 'select',
      name: 'priority',
      label: 'priority',
      items: travail.plan?.priorities?.map((p) => ({
        value: p.id,
        title: p.name,
      })),
    },
    {
      type: 'date',
      name: 'due',
      label: 'due',
    },
    {
      type: 'autocomplete',
      name: 'assignee',
      label: 'assignee',
      clearable: true,
      fetchItems: (search: string) => travail.getAssignees(search),
      itemValue: 'value',
      itemTitle: 'title',
      debounce: 300,
      minSearchLength: 1,
    },
  ],
  actions: [{ name: 'submit' }],
  actionSubmit: 'submit',
})
</script>
