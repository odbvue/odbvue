<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12" sm="8">
        <v-badge bordered offset-x="-8" :content="travail.key"
          ><h1>{{ travail.board?.title }}</h1></v-badge
        >
        <v-btn icon="$mdiPencil" class="ml-8" variant="text" density="comfortable" />
      </v-col>
      <v-col cols="12" sm="4" class="d-flex align-end justify-end">
        <v-btn-toggle v-model="travail.viewMode" mandatory>
          <v-btn size="small" value="board" :title="t('board-view')">
            <v-icon>$mdiViewModule</v-icon>
          </v-btn>
          <v-btn size="small" value="calendar" :title="t('calendar-view')">
            <v-icon>$mdiCalendarMonth</v-icon>
          </v-btn>
        </v-btn-toggle>
      </v-col>
    </v-row>
    <v-row v-if="travail.viewMode == 'board'">
      <v-col cols="12" sm="4" v-for="status in travail.statuses" :key="status.value">
        <h2>{{ t(status.title) }}</h2>

        <v-card
          v-for="task in travail.tasks.filter((t) => t.status === status.value)"
          :key="task.num"
          class="mt-4 mb-2"
        >
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
            <v-fab
              variant="tonal"
              size="small"
              :color="
                travail.statuses.find((s) => s.value === task.status)?.attrs.format.color ||
                'primary'
              "
            >
              {{ travail.statuses.find((s) => s.value === task.status)?.title }}
              <v-speed-dial activator="parent" location="top left">
                <v-btn
                  v-for="status in travail.statuses"
                  :key="status.value"
                  :color="status.attrs.format.color"
                  @click="
                    travail.postTask({ ...task, ...{ status: status.value } })
                    travail.init()
                  "
                >
                  {{ t(status.title) }}
                </v-btn>
              </v-speed-dial>
            </v-fab>
            <v-btn prepend-icon="$mdiPlus" :to="`/travail/new-task?parent-num=${task.num}`" text>
              {{ t('task') }}
            </v-btn>
            <v-btn prepend-icon="$mdiPencil" :to="`/travail/${task.num}`" text>
              {{ t('open') }}
            </v-btn>
          </v-card-actions>
        </v-card>
        <v-card
          class="d-flex align-center justify-center"
          min-height="150px"
          :to="`/travail/new-task?status=${status.value}`"
        >
          <v-icon size="48px">$mdiPlus</v-icon>
        </v-card>
      </v-col>
    </v-row>
    <v-row v-else>
      <v-col>
        <div>
          <v-toolbar flat>
            <v-btn
              class="me-4"
              color="grey-darken-2"
              variant="outlined"
              @click="calendarValue = ''"
            >
              {{ t('today') }}
            </v-btn>
            <v-btn
              color="grey-darken-2"
              size="small"
              variant="text"
              icon="$mdiChevronLeft"
              @click="calendar?.prev()"
            />
            <v-btn
              color="grey-darken-2"
              size="small"
              variant="text"
              icon="$mdiChevronRight"
              @click="calendar?.next()"
            />
            <v-toolbar-title v-if="calendar">
              {{ calendar.title }}
            </v-toolbar-title>
          </v-toolbar>

          <v-sheet height="600">
            <v-calendar
              ref="calendar"
              v-model="calendarValue"
              :events="calendarEvents"
              type="month"
              @change="getCalendarEvents"
              @click:event="showCalendarEvent"
            ></v-calendar>
          </v-sheet>
        </div>
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

import type { VCalendar } from 'vuetify/components'
const calendar = ref<VCalendar | null>(null)
const calendarValue = ref('')

interface CalendarEvent {
  name: string
  start?: string
  end?: string
  color: string
}

const calendarEvents = ref<CalendarEvent[]>([])

const getCalendarEvents = () => {
  const events = travail.tasks
    .filter((task) => task.due)
    .map((task) => ({
      name: task.title,
      start: task.due,
      end: task.due,
      color: travail.statuses.find((s) => s.value === task.status)?.attrs.format.color || 'primary',
    }))
  calendarEvents.value = events
}

const router = useRouter()
interface CalendarEventSlotScope {
  event: {
    name?: string
    start?: string
    end?: string
    color?: string
  }
}
const showCalendarEvent = (_event: Event, slotScope: CalendarEventSlotScope) => {
  const { event } = slotScope
  const eventName = event.name ?? ''
  const eventStart = event.start ?? ''
  console.log('Clicked event:', event)
  const task = travail.tasks.find((t) => t.title === eventName && t.due === eventStart)
  if (task) {
    router.push(`/travail/${task.num}`)
  }
}

onMounted(async () => {
  await travail.init()
})
</script>
