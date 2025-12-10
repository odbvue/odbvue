<template>
  <v-container>
    <v-row>
      <v-col cols="12" sm="6">
        <h2>Details</h2>
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
      </v-col>

      <v-col cols="12" sm="6" v-if="num != 'new-task'">
        <h2>Comments</h2>
        <v-ov-form
          :data="notesData"
          :options="notesOptions"
          @submit="saveNotes"
          @action="handleNotesAction"
        />
        <v-sheet v-for="note in travail.notes" :key="note.id" class="pa-4 border-b-sm">
          <v-label class="text-subtitle-2">{{ note.author_fullname }} ({{ note.created }})</v-label>
          <v-sheet class="ml-2">
            <div class="mt-2" v-html="mdToHtml(note.content)"></div>
            <v-btn
              class="mt-2"
              variant="text"
              v-if="note.file_id"
              @click="travail.downloadFile(note.file_id, note.file_name)"
              prepend-icon="$mdiDownload"
            >
              {{ note.file_name }}
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
    await travail.fetchNotesPage(num.value, 1)
  }
})

const hasPrevNotesPage = computed(() => travail.notesPage > 1)
const hasNextNotesPage = computed(() => travail.notesHasNext)

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

const taskData = ref<OvFormData>({})
const taskOptions = computed<OvFormOptions>(() => ({
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

import MarkdownIt from 'markdown-it'
const markdownIt = new MarkdownIt()
const mdToHtml = (md: string): string => {
  if (!md) return ''
  return markdownIt.render(md)
}

const saveNotes = async (notes: OvFormData) => {
  await travail.postNote(notes)
}

const handleNotesAction = async (action: string, data: OvFormData) => {
  if (action === 'attach') {
    // Handle attachment action here
    console.log('Attach action triggered', data)
  }
}

const notesData = ref<OvFormData>({})
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
