<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12" sm="8">
        <v-badge bordered offset-x="-8" :content="travail.key"
          ><h1>{{ travail.board?.title }}</h1></v-badge
        >
        <v-btn
          icon="$mdiPencil"
          class="ml-8"
          variant="text"
          density="comfortable"
          to="/travail/boards"
        />
      </v-col>
      <v-col cols="12" sm="4" class="d-flex align-end justify-end">
        <v-btn-toggle v-model="travail.viewMode" mandatory>
          <v-btn size="small" value="board" :title="t('board-view')">
            <v-icon>$mdiViewModule</v-icon>
          </v-btn>
          <v-btn size="small" value="calendar" :title="t('calendar-view')">
            <v-icon>$mdiCalendarMonth</v-icon>
          </v-btn>
          <v-btn size="small" value="list" :title="t('list-view')">
            <v-icon>$mdiViewList</v-icon>
          </v-btn>
        </v-btn-toggle>
      </v-col>
    </v-row>
    <TravailBoardView v-if="travail.viewMode === 'board'" :travail="travail" />
    <TravailCalendarView
      v-else-if="travail.viewMode === 'calendar'"
      :travail="travail"
      @openTask="openTask"
    />
    <TravailListView v-else />
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
import TravailBoardView from './_components/TravailBoardView.vue'
import TravailCalendarView from './_components/TravailCalendarView.vue'
import TravailListView from './_components/TravailListView.vue'
const travail = useTravailStore()
const { t } = useI18n()
const router = useRouter()

const openTask = (num: string) => {
  router.push(`/travail/${num}`)
}

onMounted(async () => {
  await travail.init()
})
</script>
