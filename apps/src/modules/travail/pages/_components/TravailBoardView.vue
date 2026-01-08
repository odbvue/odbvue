<template>
  <v-row>
    <v-col cols="12">
      <v-chip
        v-for="chip in filterChips"
        :key="`${chip.name}-${chip.value}`"
        :prepend-icon="chip.icon"
        class="ma-1"
        color="primary"
        closable
        rounded
        start
        @click:close="removeFilter(chip.name, chip.value)"
      >
        <strong>{{ chip.value }}</strong
        >&nbsp;({{ t(chip.label) }})
      </v-chip>
    </v-col>
  </v-row>
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

      <template v-for="(task, idx) in tasksInStatus(status.value)" :key="task.num">
        <div
          class="my-2"
          style="min-height: 12px"
          :class="{ 'ov-dnd-column--active': activeDropKey === `gap:${status.value}:${idx}` }"
          :style="
            activeDropKey === `gap:${status.value}:${idx}` ? dndDropColumnActiveStyle : undefined
          "
          @dragenter.stop.prevent="enterDropTarget(`gap:${status.value}:${idx}`)"
          @dragleave.stop="leaveDropTarget(`gap:${status.value}:${idx}`)"
          @dragover.stop.prevent
          @drop.stop="onDropRank(status.value, idx, $event)"
        >
          <transition name="ov-drop-slot" mode="out-in">
            <v-card
              v-if="isDragging && activeDropKey === `gap:${status.value}:${idx}`"
              key="placeholder"
              variant="outlined"
              color="primary"
              class="w-100"
              min-height="72px"
            />
            <div v-else key="spacer" class="ov-drop-gap-spacer" />
          </transition>
        </div>

        <v-card
          class="mt-4 mb-2 ov-dnd-card cursor-grab"
          :class="{ 'ov-dnd-card--dragging': draggingNum === task.num }"
          :style="
            draggingNum === task.num
              ? [dndCardBaseStyle, dndCardDraggingStyle, cardBackgroundStyle(task.status)]
              : [dndCardBaseStyle, cardBackgroundStyle(task.status)]
          "
          draggable="true"
          @dragstart="onDragStart(task, $event)"
          @dragend="endDrag"
        >
          <v-card-title class="d-flex align-center">
            <v-btn
              icon="$mdiContentCopy"
              size="small"
              variant="text"
              class="mr-2"
              @click="copyTaskLinkToClipboard(task.num)"
            />
            <v-badge bordered :content="task.num" :offset-x="-8">{{
              truncateMiddle(task.title, 12)
            }}</v-badge>
          </v-card-title>

          <v-card-text class="flex-grow-1">
            <v-chip
              v-for="detail in travail.taskDetails(task.num)"
              :key="detail.label"
              :color="detail.color"
              :prepend-icon="isFilterActive(detail) ? '$mdiFilterCheck' : '$mdiFilterPlus'"
              link
              class="ma-1"
              density="compact"
              rounded
              @click="toggleFilter(detail)"
            >
              <strong>{{ detail.value }}</strong
              >&nbsp;({{ t(detail.label) }})
            </v-chip>
          </v-card-text>

          <v-card-actions>
            <v-fab
              variant="tonal"
              size="small"
              :color="statusColorByValue[task.status] || 'primary'"
            >
              {{ statusTitleByValue[task.status] || task.status }}
              <v-speed-dial activator="parent" location="top left">
                <v-btn key="-1" color="secondary" @click="travail.postTaskArchive(task.num)">
                  {{ t('archive') }}
                </v-btn>
                <v-spacer key="-2"></v-spacer>
                <v-spacer key="-3"></v-spacer>
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
      </template>

      <div
        class="my-2"
        style="min-height: 12px"
        :class="{ 'ov-dnd-column--active': activeDropKey === `gap:${status.value}:last` }"
        :style="activeDropKey === `gap:${status.value}:last` ? dndDropColumnActiveStyle : undefined"
        @dragenter.stop.prevent="enterDropTarget(`gap:${status.value}:last`)"
        @dragleave.stop="leaveDropTarget(`gap:${status.value}:last`)"
        @dragover.stop.prevent
        @drop.stop="onDropRankEnd(status.value, $event)"
      >
        <transition name="ov-drop-slot" mode="out-in">
          <v-card
            v-if="isDragging && activeDropKey === `gap:${status.value}:last`"
            key="placeholder"
            variant="outlined"
            color="primary"
            class="w-100"
            min-height="72px"
          />
          <div v-else key="spacer" class="ov-drop-gap-spacer" />
        </transition>
      </div>

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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TravailStore } from '../travail'
import { useHtml5DragDrop } from '@/composables/dnd'
import { truncateMiddle } from '../_utils/text'
import { useCardBackground } from '@/composables/ui'

const cardBackgroundStyle = (status: string): { background: string } => {
  const bgComputed = useCardBackground(
    status === 'doing'
      ? '#E3F2FD'
      : status === 'todo'
        ? '#FFF3E0'
        : status === 'done'
          ? '#E8F5E9'
          : '#FFFFFF',
  )
  return bgComputed.value
}

const props = defineProps<{ travail: TravailStore }>()
const travail = props.travail

const { t } = useI18n()

type Task = (typeof travail.tasks)[number]

type TaskDetail = {
  value: string
  label: string
  color?: string
}

type BoardFilter = {
  name: string
  value: string
}

type FilterChip = {
  name: string
  label: string
  value: string
  icon: string
}

const filterChips = computed<FilterChip[]>(() =>
  travail.activeBoardFilters.map(
    (f): FilterChip => ({
      name: f.name,
      label: f.name,
      value: f.value,
      icon: '$mdiFilter',
    }),
  ),
)

const isFilterActive = (detail: TaskDetail): boolean =>
  travail.activeBoardFilters.some((f) => f.name === detail.label && f.value === detail.value)

const toggleFilter = (detail: TaskDetail) => {
  const filter: BoardFilter = { name: detail.label, value: detail.value }
  travail.toggleActiveBoardFilter(filter)
}

const removeFilter = (name: string, value: string) => {
  travail.removeActiveBoardFilter(name, value)
}

const INF_RANK = Number.POSITIVE_INFINITY

const filteredTasks = computed<Task[]>(() => {
  const filters = travail.activeBoardFilters
  if (!filters.length) return travail.tasks

  return travail.tasks.filter((task) => {
    const details = travail.taskDetails(task.num)
    return filters.every((f) => details.some((d) => d.label === f.name && d.value === f.value))
  })
})

const tasksByStatus = computed<Record<string, Task[]>>(() => {
  const grouped: Record<string, Task[]> = {}
  for (const task of filteredTasks.value) {
    const status = task.status
    ;(grouped[status] ||= []).push(task)
  }

  for (const [statusKey, statusTasks] of Object.entries(grouped)) {
    grouped[statusKey] = statusTasks.slice().sort((a, b) => {
      const ar = a.rank_value ?? INF_RANK
      const br = b.rank_value ?? INF_RANK
      if (ar !== br) return ar - br
      return b.created.localeCompare(a.created)
    })
  }

  for (const status of travail.statuses) {
    grouped[status.value] ||= []
  }

  return grouped
})

const tasksInStatus = (status: string): Task[] => tasksByStatus.value[status] ?? []

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

const isDragging = computed(() => draggingPayload.value !== null)

const onDragStart = (task: Task, event: DragEvent) => {
  startDrag({ num: task.num }, event)
}

const onDrop = async (toStatus: string, event: DragEvent) => {
  event.preventDefault()
  const payload = extractPayload(event)
  if (!payload) return

  await travail.postTaskMove(payload.num, toStatus, null, null)
  endDrag()
}

const onDropRank = async (toStatus: string, beforeIdx: number, event: DragEvent) => {
  event.preventDefault()
  const payload = extractPayload(event)
  if (!payload) return

  const tasks = tasksInStatus(toStatus)
  const before = beforeIdx > 0 ? (tasks[beforeIdx - 1]?.num ?? null) : null
  const after = beforeIdx < tasks.length ? (tasks[beforeIdx]?.num ?? null) : null

  if (
    tasks.some((t) => t.num === payload.num) &&
    (before === payload.num || after === payload.num)
  ) {
    endDrag()
    return
  }

  await travail.postTaskMove(payload.num, toStatus, before, after)
  endDrag()
}

const onDropRankEnd = async (toStatus: string, event: DragEvent) => {
  event.preventDefault()
  const payload = extractPayload(event)
  if (!payload) return

  const tasks = tasksInStatus(toStatus)
  const before = tasks.length ? (tasks[tasks.length - 1]?.num ?? null) : null

  await travail.postTaskMove(payload.num, toStatus, before, null)
  endDrag()
}

const copyTaskLinkToClipboard = async (taskNum: string) => {
  const url = `${window.location.origin}/travail/${taskNum}`
  try {
    await navigator.clipboard.writeText(url)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}
</script>
