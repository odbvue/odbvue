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
          :class="{
            'ov-dnd-column--active':
              activeDropKey === gapKey(status.value, beforeNum(status.value, idx), task.num),
          }"
          :style="
            activeDropKey === gapKey(status.value, beforeNum(status.value, idx), task.num)
              ? dndDropColumnActiveStyle
              : undefined
          "
          @dragenter.stop.prevent="
            enterDropTarget(gapKey(status.value, beforeNum(status.value, idx), task.num))
          "
          @dragleave.stop="
            leaveDropTarget(gapKey(status.value, beforeNum(status.value, idx), task.num))
          "
          @dragover.stop.prevent
          @drop.stop="onDropRank(status.value, beforeNum(status.value, idx), task.num, $event)"
        >
          <transition name="ov-drop-slot" mode="out-in">
            <v-card
              v-if="isDragging && isGapActive(status.value, beforeNum(status.value, idx), task.num)"
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
          class="mt-4 mb-2 ov-dnd-card"
          :class="{ 'ov-dnd-card--dragging': draggingNum === task.num }"
          :style="
            draggingNum === task.num ? [dndCardBaseStyle, dndCardDraggingStyle] : dndCardBaseStyle
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
            <v-badge bordered :content="task.num" :offset-x="-8">{{ task.title }}</v-badge>
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
        :class="{
          'ov-dnd-column--active':
            activeDropKey === gapKey(status.value, lastNum(status.value), null),
        }"
        :style="
          activeDropKey === gapKey(status.value, lastNum(status.value), null)
            ? dndDropColumnActiveStyle
            : undefined
        "
        @dragenter.stop.prevent="enterDropTarget(gapKey(status.value, lastNum(status.value), null))"
        @dragleave.stop="leaveDropTarget(gapKey(status.value, lastNum(status.value), null))"
        @dragover.stop.prevent
        @drop.stop="onDropRank(status.value, lastNum(status.value), null, $event)"
      >
        <transition name="ov-drop-slot" mode="out-in">
          <v-card
            v-if="isDragging && isGapActive(status.value, lastNum(status.value), null)"
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
import type { TravailStore } from '../travail'
import { useHtml5DragDrop } from '@/composables/dnd'

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

const beforeNum = (status: string, idx: number): string | null => {
  if (idx <= 0) return null
  const list = tasksInStatus(status)
  return list[idx - 1]?.num ?? null
}

const lastNum = (status: string): string | null => {
  const list = tasksInStatus(status)
  return list.length ? list[list.length - 1]!.num : null
}

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

const gapKey = (status: string, before: string | null, after: string | null) =>
  `gap:${status}:${before ?? 'START'}:${after ?? 'END'}`

const isGapActive = (status: string, before: string | null, after: string | null) =>
  activeDropKey.value === gapKey(status, before, after)

const isDragging = computed(() => draggingPayload.value !== null)

const onDragStart = (task: Task, event: DragEvent) => {
  startDrag({ num: task.num }, event)
}

const onDrop = async (toStatus: string, event: DragEvent) => {
  event.preventDefault()
  const payload = extractPayload(event)
  if (!payload) return

  const columnTasks = (tasksByStatus.value[toStatus] || []).filter((t) => t.num !== payload.num)
  const before = columnTasks.length ? columnTasks[columnTasks.length - 1]!.num : null
  await travail.postTaskMove(payload.num, toStatus, before, null)
  endDrag()
}

const onDropRank = async (
  toStatus: string,
  before: string | null,
  after: string | null,
  event: DragEvent,
) => {
  event.preventDefault()
  const payload = extractPayload(event)
  if (!payload) return

  const task = travail.tasks.find((t) => t.num === payload.num)
  if (!task) return

  if (task.status === toStatus && (before === task.num || after === task.num)) {
    endDrag()
    return
  }

  await travail.postTaskMove(payload.num, toStatus, before, after)
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
