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

    <v-ov-form :data="taskData" :options="taskOptions" @submit="saveTask" />
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

import { useRoute } from 'vue-router'
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
const status = ref(routeQueryValue('status'))

import { useTravailStore } from './travail.ts'
import type { OvFormFieldError } from '@/components/index.ts'
const travail = useTravailStore()

onMounted(async () => {
  if (num.value && num.value !== 'new-task') {
    const task = await travail.tasks.find((t) => t.num === num.value)
    taskData.value = task || {}
  }
})

const errors = ref<OvFormFieldError[]>([])

const router = useRouter()
const saveTask = async (task: OvFormData) => {
  const { data } = await travail.postTask(task)
  if (data?.errors) {
    errors.value = data.errors
    return
  }
  router.push('/travail')
}

const taskData = ref<OvFormData>({})
const taskOptions = computed<OvFormOptions>(() => ({
  cols: 2,
  fields: [
    {
      type: 'text',
      name: 'parent',
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
      name: 'key',
      value: travail.key,
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
      type: 'date',
      name: 'due',
      label: 'due',
      clearable: true,
    },
    {
      type: 'select',
      name: 'priority',
      label: 'priority',
      items: travail.priorities,
      clearable: true,
    },
    {
      type: 'select',
      name: 'status',
      label: 'status',
      items: travail.statuses,
      value: status.value || '',
    },
    {
      type: 'number',
      name: 'estimated',
      label: `effort`,
      clearable: true,
    },
    {
      type: 'autocomplete',
      name: 'assignee',
      label: 'assignee',
      clearable: true,
      fetchItems: (search: string) => travail.getAssignees(search),
    },
  ],
  errors: errors.value,
  actions: [{ name: 'save' }],
  actionSubmit: 'save',
}))
</script>
