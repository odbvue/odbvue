<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12" sm="8">
        <v-badge bordered offset-x="-8" :content="travail.key"
          ><h1>{{ travail.plan?.title }}</h1></v-badge
        >
        <v-btn icon="$mdiPencil" class="ml-8" variant="text" density="comfortable" />
      </v-col>
    </v-row>
    <v-row>
      <v-col v-for="task in travail.tasks" :key="task.num" cols="12" md="4" sm="6">
        <v-card class="h-100 d-flex flex-column">
          <v-card-title
            ><v-badge bordered :content="task.num" :offset-x="-8">{{
              task.title
            }}</v-badge></v-card-title
          >
          <v-card-text class="flex-grow-1">
            <v-chip
              v-for="detail in travail.taskDetails(task.num)"
              :key="detail.label"
              :color="detail.color"
              class="ma-1"
              density="compact"
              rounded
            >
              <strong>{{ detail.value }}</strong
              >&nbsp;({{ t(detail.label) }})
            </v-chip>
          </v-card-text>
          <v-card-actions>
            <v-btn prepend-icon="$mdiPlus" :to="`/travail/new-task?parent-num=${task.num}`" text>
              {{ t('task') }}
            </v-btn>
            <v-btn prepend-icon="$mdiPencil" :to="`/travail/${task.num}`" text>
              {{ t('open') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col>
        <v-card
          class="d-flex align-center justify-center"
          height="100%"
          min-height="150px"
          :to="`/travail/new-task?parent-num=`"
        >
          <v-icon size="48px">$mdiPlus</v-icon>
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
const { t } = useI18n()

onMounted(async () => {
  await travail.init()
})
</script>
