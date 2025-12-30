<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h2>Details</h2>
        <v-ov-form
          :data="taskData"
          :options="taskOptions"
          @submit="saveTask"
          @cancel="cancelTask"
        />
      </v-col>

      <v-col cols="12" sm="6" v-if="num != 'new-task'">
        <h2>Comments</h2>
        <v-ov-form
          ref="notesFormRef"
          :data="notesData"
          :options="notesOptions"
          @submit="saveNotes"
          @action="handleNotesAction"
        />
        <v-sheet v-for="note in travail.notes" :key="note.id" class="pa-4 border-b-sm">
          <v-label class="text-subtitle-2">{{ note.author_fullname }} ({{ note.created }})</v-label>
          <v-sheet class="ml-2">
            <div class="mt-2 markdown-content" v-html="mdToHtml(note.content)"></div>
            <v-btn
              class="mt-2"
              variant="text"
              v-if="note.file_id"
              @click="travail.downloadFile(note.file_id, note.file_name)"
              prepend-icon="$mdiDownload"
            >
              {{ formatFileName(note.file_name) }}
            </v-btn>
            <v-btn
              class="mt-2"
              variant="text"
              size="small"
              v-if="note.content"
              @click="replyToNote(note)"
              prepend-icon="$mdiReply"
            >
              Reply
            </v-btn>
            <v-sheet v-if="note.assistant" class="text-body-2 font-italic ma-2 mt-4">
              <v-icon left>$mdiRobot</v-icon>
              {{ note.assistant.slice(0, 100) }}
              <v-btn
                size="x-small"
                variant="text"
                @click="showDialog('assistant', note.assistant)"
                icon="$mdiDotsHorizontal"
              />
            </v-sheet>
          </v-sheet>
        </v-sheet>
        <v-row no-gutters class="mt-4">
          <v-col cols="8">
            <v-btn
              v-if="hasPrevNotesPage || hasNextNotesPage"
              size="small"
              variant="tonal"
              class="ma-1"
              icon="$mdiChevronLeft"
              :disabled="!hasPrevNotesPage"
              @click="goToNotesPage(travail.notesPage - 1)"
            />
            <v-btn
              v-if="hasPrevNotesPage || hasNextNotesPage"
              size="small"
              variant="tonal"
              class="ma-1"
              icon="$mdiChevronRight"
              :disabled="!hasNextNotesPage"
              @click="goToNotesPage(travail.notesPage + 1)"
            />
          </v-col>
          <v-col cols="4" class="text-right">
            <v-btn size="small" variant="tonal" icon="$mdiRefresh" @click="refreshNotes" />
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" sm="6" v-if="num != 'new-task'">
        <h2>Worklog</h2>
        <v-ov-form :data="worklogData" :options="worklogOptions" @submit="saveWorklog" />
        <v-sheet
          v-for="work in travail.worklog"
          :key="work.key + work.created"
          class="pa-4 border-b-sm"
        >
          <v-label class="text-subtitle-2">{{ work.author }} ({{ work.created }})</v-label>
          <v-sheet class="ml-2">
            <div class="d-flex align-center gap-2 mt-2">
              <v-chip size="small" color="primary" variant="tonal">
                {{ work.workdate }}
              </v-chip>
              <v-chip size="small" color="secondary" variant="tonal">
                {{ formatDuration(work.duration) }}
              </v-chip>
            </div>
            <div v-if="work.notes" class="mt-2 text-body-2">{{ work.notes }}</div>
          </v-sheet>
        </v-sheet>
        <v-row no-gutters class="mt-4">
          <v-col cols="8">
            <v-btn
              v-if="hasPrevWorklogPage || hasNextWorklogPage"
              size="small"
              variant="tonal"
              class="ma-1"
              icon="$mdiChevronLeft"
              :disabled="!hasPrevWorklogPage"
              @click="goToWorklogPage(travail.worklogPage - 1)"
            />
            <v-btn
              v-if="hasPrevWorklogPage || hasNextWorklogPage"
              size="small"
              variant="tonal"
              class="ma-1"
              icon="$mdiChevronRight"
              :disabled="!hasNextWorklogPage"
              @click="goToWorklogPage(travail.worklogPage + 1)"
            />
          </v-col>
          <v-col cols="4" class="text-right">
            <v-btn size="small" variant="tonal" icon="$mdiRefresh" @click="refreshWorklog" />
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <v-ov-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :content="dialogContent"
      closeable
      scrollable
      copyable
    />
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

import { useRouteParams } from '@/stores/app/navigation'
import { truncateMiddle } from './_utils/text'

const { param, query } = useRouteParams()
const num = param('num')
const parentNum = query('parent-num')
const status = query('status')

const formatFileName = (fileName: string): string => truncateMiddle(fileName, 6, 7)

import { useTravailStore } from './travail.ts'
import type { OvFormFieldError } from '@/components/index.ts'
const travail = useTravailStore()

onMounted(async () => {
  if (num.value && num.value !== 'new-task') {
    const task = await travail.getTask(num.value)
    taskData.value = task || {}
    await travail.fetchNotesPage(num.value, 1)
    await travail.fetchWorklogPage(num.value, 1)
  }
})

const hasPrevNotesPage = computed(() => travail.notesPage > 1)
const hasNextNotesPage = computed(() => travail.notesHasNext)

const hasPrevWorklogPage = computed(() => travail.worklogPage > 1)
const hasNextWorklogPage = computed(() => travail.worklogHasNext)

const goToWorklogPage = async (page: number) => {
  await travail.fetchWorklogPage(num.value, page)
}

const refreshWorklog = async () => {
  await travail.fetchWorklogPage(num.value, travail.worklogPage)
}

import { minutesToDuration } from '@/components/index.ts'

const formatDuration = (minutes: number): string => {
  return minutesToDuration(minutes)
}

const worklogData = ref<OvFormData>({})

const saveWorklog = async (work: OvFormData) => {
  await travail.postWork(work)
  worklogData.value = {}
}

const worklogOptions = computed<OvFormOptions>(() => ({
  cols: 2,
  fields: [
    {
      type: 'text',
      name: 'num',
      value: num.value || '',
      hidden: true,
    },
    {
      type: 'date',
      name: 'work_date',
      label: 'date',
      value: new Date().toISOString().split('T')[0],
    },
    {
      type: 'duration',
      name: 'duration',
      label: 'duration',
    },
    {
      type: 'textarea',
      name: 'notes',
      label: 'notes',
      rows: 3,
    },
  ],
  actions: [{ name: 'log.work' }],
  actionSubmit: 'log.work',
}))

const goToNotesPage = async (page: number) => {
  await travail.fetchNotesPage(num.value, page)
}

const refreshNotes = async () => {
  await travail.fetchNotesPage(num.value, travail.notesPage)
}

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
const cancelTask = () => {
  router.push('/travail')
}

const taskData = ref<OvFormData>({})
const taskOptions = computed<OvFormOptions>(() => ({
  cols: 3,
  fields: [
    {
      type: 'text',
      name: 'num',
      label: 'key',
      value: num.value == 'new-task' ? '' : num.value || '',
      disabled: true,
    },
    {
      type: 'text',
      name: 'parent',
      label: 'parent',
      value: parentNum.value || '',
      disabled: true,
      hidden: parentNum.value ? false : true,
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
      name: 'type',
      label: 'type',
      items: travail.types,
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
      type: 'duration',
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
    {
      type: 'date',
      name: 'archived',
      label: 'archived',
      clearable: true,
    },
  ],
  errors: errors.value,
  actions: [{ name: 'save' }, { name: 'cancel', format: { variant: 'outlined' } }],
  actionSubmit: 'save',
  actionCancel: 'cancel',
}))

import MarkdownIt from 'markdown-it'
const markdownIt = new MarkdownIt()
const mdToHtml = (md: string): string => {
  if (!md) return ''
  return markdownIt.render(md)
}

const saveNotes = async (notes: OvFormData) => {
  await travail.postNote(notes)
  notesData.value = {}
}

const handleNotesAction = async (action: string, data: OvFormData) => {
  if (action === 'attach') {
    // Handle attachment action here
    console.log('Attach action triggered', data)
  }
}

const notesData = ref<OvFormData>({})
const notesFormRef = ref<{
  $el?: Element
  focusField: (name: string, position?: 'start' | 'end' | number) => void
  scrollToAndFocus: (name: string, position?: 'start' | 'end' | number) => void
} | null>(null)

const replyToNote = (note: { content: string | null; author_fullname: string }) => {
  if (!note.content) {
    // If there's no content, just focus the editor
    notesFormRef.value?.scrollToAndFocus('content', 'start')
    return
  }
  const quotedContent = note.content
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
  // Use non-breaking space to create an empty line that markdown won't strip
  const replyText = `\u00A0\n\n> **${note.author_fullname}:**\n${quotedContent}`
  notesData.value = { ...notesData.value, content: replyText }
  notesFormRef.value?.scrollToAndFocus('content', 'start')
}

const notesOptions = computed<OvFormOptions>(() => ({
  fields: [
    {
      type: 'text',
      name: 'num',
      value: num.value || '',
      hidden: true,
    },
    {
      type: 'markdown',
      name: 'content',
      label: 'comment',
      minHeight: '200px',
      maxHeight: '200px',
      toolbar: [
        'bold',
        'italic',
        'heading1',
        'heading2',
        'bulletList',
        'orderedList',
        'blockquote',
      ],
    },
    {
      type: 'file',
      name: 'file',
      label: 'attachment',
      multiple: true,
    },
  ],
  actions: [{ name: 'comment' }],
  actionSubmit: 'comment',
}))

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogContent = ref('')

const showDialog = (title: string, content: string) => {
  dialogTitle.value = title
  dialogContent.value = content
  dialogVisible.value = true
}
</script>

<style scoped>
.markdown-content :deep(blockquote) {
  border-left: 3px solid rgba(var(--v-theme-primary), 0.5);
  margin: 0.5rem 0;
  padding-left: 1rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-style: italic;
}

.markdown-content :deep(blockquote p) {
  margin: 0;
}
</style>
