<template>
  <v-row>
    <v-col>
      <div>
        <v-toolbar flat>
          <v-btn class="me-4" color="grey-darken-2" variant="outlined" @click="calendarValue = ''">
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
            @click:event="onClickEvent"
          ></v-calendar>
        </v-sheet>
      </div>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { VCalendar } from 'vuetify/components'
import type { TravailStore } from '../travail'

const props = defineProps<{ travail: TravailStore }>()

const emit = defineEmits<{
  openTask: [num: string]
}>()

const { t } = useI18n()

const calendar = ref<VCalendar | null>(null)
const calendarValue = ref('')

type CalendarEvent = {
  name: string
  start?: string
  end?: string
  color: string
  num?: string
}

const statusColorByValue = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const status of props.travail.statuses) map[status.value] = status.attrs.format.color
  return map
})

const calendarEvents = computed<CalendarEvent[]>(() => {
  return props.travail.tasks
    .filter((task) => task.due)
    .map((task) => ({
      name: task.title,
      start: task.due,
      end: task.due,
      color: statusColorByValue.value[task.status] || 'primary',
      num: task.num,
    }))
})

const onClickEvent = (_event: Event, slotScope: { event: unknown }) => {
  const { event } = slotScope
  if (!event || typeof event !== 'object') return
  if (!('num' in event)) return

  const num = (event as { num?: unknown }).num
  if (typeof num === 'string' && num) emit('openTask', num)
}
</script>
