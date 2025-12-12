<template>
  <v-row>
    <v-col
      cols="12"
      sm="4"
      v-for="status in travail.statuses"
      :key="status.value"
      class="ov-dnd-column"
      :class="{ 'ov-dnd-column--active': activeDropKey === status.value }"
      :style="activeDropKey === status.value ? dndDropColumnActiveStyle : undefined"
      @dragenter.prevent="enterDropTarget(status.value)"
      @dragleave="leaveDropTarget(status.value)"
      @dragover.prevent
      @drop="onDrop(status.value, $event)"
    >
      <h2>{{ t(status.title) }}</h2>

      <v-card
        v-for="task in tasksByStatus[status.value]"
        :key="task.num"
        class="mt-4 mb-2 ov-dnd-card"
        :class="{ 'ov-dnd-card--dragging': draggingNum === task.num }"
        :style="
          draggingNum === task.num ? [dndCardBaseStyle, dndCardDraggingStyle] : dndCardBaseStyle
        "
        draggable="true"
        @dragstart="onDragStart(task, $event)"
        @dragend="endDrag"
      >
        <v-card-title>
          <v-badge bordered :content="task.num" :offset-x="-8">{{ task.title }}</v-badge>
        </v-card-title>

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
          <v-fab variant="tonal" size="small" :color="statusColorByValue[task.status] || 'primary'">
            {{ statusTitleByValue[task.status] || task.status }}
            <v-speed-dial activator="parent" location="top left">
              <v-btn
                v-for="s in travail.statuses"
                :key="s.value"
                :color="s.attrs.format.color"
                @click="travail.postTaskStatus(task.num, s.value)"
              >
                {{ t(s.title) }}
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
</template>

<script setup lang="ts">
import type { TravailStore } from '../travail'
import { useHtml5DragDrop } from '@/composables/dnd'

const props = defineProps<{ travail: TravailStore }>()
const travail = props.travail

const { t } = useI18n()

type Task = (typeof travail.tasks)[number]

const tasksByStatus = computed<Record<string, Task[]>>(() => {
  const grouped: Record<string, Task[]> = {}
  for (const task of travail.tasks) {
    const status = task.status
    ;(grouped[status] ||= []).push(task)
  }

  for (const status of travail.statuses) {
    grouped[status.value] ||= []
  }

  return grouped
})

const statusColorByValue = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const status of travail.statuses) map[status.value] = status.attrs.format.color
  return map
})

const statusTitleByValue = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const status of travail.statuses) map[status.value] = t(status.title)
  return map
})

type DragPayload = {
  num: string
}

const isDragPayload = (value: unknown): value is DragPayload => {
  if (!value || typeof value !== 'object') return false
  if (!('num' in value)) return false
  return typeof (value as Record<string, unknown>).num === 'string'
}

const {
  draggingPayload,
  activeDropKey,
  dndCardBaseStyle,
  dndCardDraggingStyle,
  dndDropColumnActiveStyle,
  startDrag,
  endDrag,
  extractPayload,
  enterDropTarget,
  leaveDropTarget,
} = useHtml5DragDrop<DragPayload, string>({
  mime: 'application/x-odbvue-travail-task',
  toText: (p) => p.num,
  fromText: (text) => (text ? { num: text } : null),
  fromJson: (value) => (isDragPayload(value) ? value : null),
})

const draggingNum = computed(() => draggingPayload.value?.num ?? null)

const onDragStart = (task: Task, event: DragEvent) => {
  startDrag({ num: task.num }, event)
}

const onDrop = async (toStatus: string, event: DragEvent) => {
  event.preventDefault()
  const payload = extractPayload(event)
  if (!payload) return

  const task = travail.tasks.find((t) => t.num === payload.num)
  if (!task) return
  if (task.status === toStatus) return

  await travail.postTaskStatus(task.num, toStatus)
  endDrag()
}
</script>
