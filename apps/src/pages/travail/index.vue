<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12" class="d-flex justify-end">
        <v-btn
          color="primary"
          prepend-icon="$mdiPlus"
          :text="t('new.task')"
          to="/travail/new-task"
        />
      </v-col>
    </v-row>
    <v-row>
      <v-col v-for="task in travail.tasks" :key="task.key" cols="12" md="4" sm="6">
        <v-card>
          <v-card-subtitle>{{ task.key }}</v-card-subtitle>
          <v-card-title>{{ task.title }}</v-card-title>
          <v-card-text>{{ task.description }}</v-card-text>
          <v-card-text
            ><v-label>{{ t('assignee') }}:</v-label> {{ task.assignee }}</v-card-text
          >
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Travail',
    description: 'Get the work done - tasks and projects',
    icon: '$mdiBee',
    color: '#FFC107',
    visibility: 'always',
    access: 'when-authenticated',
  },
})

import { useTravailStore } from './travail.ts'
const travail = useTravailStore()
const app = useAppStore()
const { t } = useI18n()

onMounted(async () => {
  app.ui.startLoading()
  await travail.getTasks()
  app.ui.stopLoading()
})
</script>
