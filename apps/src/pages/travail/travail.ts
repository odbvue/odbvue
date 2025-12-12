import { defineStore, acceptHMRUpdate } from 'pinia'
import { processFormDataWithFiles, type OvFormFieldError } from '@/components/index.ts'

export type PostTaskResponse = {
  error?: string
  errors?: OvFormFieldError[]
}

export type PostRankResponse = {
  error?: string
  errors?: OvFormFieldError[]
}

export type PostBoardResponse = {
  error?: string
  errors?: OvFormFieldError[]
}

export const useTravailStore = defineStore(
  'travail',
  () => {
    const http = useHttp()
    const { startLoading, stopLoading } = useUiStore()

    type Board = {
      key: string
      title: string
      description: string
      settings: {
        due_warn_before_days: number
        statuses: Array<{
          value: string
          title: string
          attrs: {
            format: {
              color: string
            }
          }
        }>
        priorities: Array<{
          value: string
          title: string
          attrs: {
            format: {
              color: string
            }
          }
        }>
        units?: string
      }
    }

    type Task = {
      num: string
      key: string
      title: string
      description?: string

      due?: string
      due_details: {
        format: {
          color: string
        }
      }
      reminder?: string
      started?: string
      completed?: string

      status: string
      priority?: string

      estimated?: number
      remaining?: number
      invested?: number

      assignee?: {
        value: string
        title: string
      }

      author: string
      created: string
      editor?: string
      modified?: string

      rank_value?: number

      parent_num?: string
    }

    type TaskDetails = {
      value: string
      label: string
      color?: string
    }

    type BoardFilter = {
      name: string
      value: string
    }

    const viewModes = ['board', 'calendar'] as const
    const viewMode = ref('board')

    const boards = ref<Board[]>([])
    const board = ref<Board | null>(null)
    const key = ref('TRA')

    const boardFilters = ref<Record<string, BoardFilter[]>>({})

    const activeBoardFilters = computed<BoardFilter[]>(() => boardFilters.value[key.value] ?? [])

    const setActiveBoardFilters = (filters: BoardFilter[]) => {
      boardFilters.value = {
        ...boardFilters.value,
        [key.value]: filters,
      }
    }

    const toggleActiveBoardFilter = (filter: BoardFilter) => {
      const existing = activeBoardFilters.value
      const idx = existing.findIndex((f) => f.name === filter.name && f.value === filter.value)
      if (idx >= 0) {
        setActiveBoardFilters(existing.filter((_, i) => i !== idx))
        return
      }
      setActiveBoardFilters([...existing, filter])
    }

    const removeActiveBoardFilter = (name: string, value: string) => {
      setActiveBoardFilters(
        activeBoardFilters.value.filter((f) => !(f.name === name && f.value === value)),
      )
    }

    const clearActiveBoardFilters = () => {
      setActiveBoardFilters([])
    }

    const statuses = computed(() => board.value?.settings.statuses || [])
    const priorities = computed(() => board.value?.settings.priorities || [])

    const tasks = ref<Task[]>([])

    const init = async () => {
      startLoading()
      await getBoards('', `{"key": ["${key.value}"]}`)
      board.value = boards.value[0] ?? null
      if (!board.value) {
        key.value = 'TRA'
      }
      await getTasks('', `{"key": ["${key.value}"]}`)
      stopLoading()
    }

    const getBoards = async (
      search?: string,
      filter?: string,
      offset: number = 0,
      limit: number = 10,
    ) => {
      const { data } = await http.get<{ boards: Board[] }>('tra/boards/', {
        params: { filter, search, offset, limit },
      })
      boards.value = data?.boards || []
    }

    const postBoard = async (board: OvFormData) => {
      return await http.post<PostBoardResponse>('tra/board/', {
        data: encodeURIComponent(JSON.stringify(board)),
      })
    }

    const setActiveBoard = async (boardKey: string) => {
      key.value = boardKey
      await init()
    }

    const getTasks = async (
      search?: string,
      filter?: string,
      offset: number = 0,
      limit: number = 10,
    ) => {
      const { data } = await http.get<{ tasks: Task[] }>('tra/tasks/', {
        params: { filter, search, offset, limit },
      })
      tasks.value = data?.tasks || []
    }

    const postTask = async (task: OvFormData) => {
      return await http.post<PostTaskResponse>('tra/task/', {
        data: encodeURIComponent(JSON.stringify(task)),
      })
    }

    const postTaskStatus = async (num: string, status: string) => {
      startLoading()
      await postTask({ ...tasks.value.find((t) => t.num === num), ...{ status: status } })
      await init()
    }

    const postTaskRank = async (num: string, before: string | null, after: string | null) => {
      return await http.post<PostRankResponse>('tra/rank/', {
        num,
        before,
        after,
      })
    }

    const postTaskMove = async (
      num: string,
      toStatus: string,
      before: string | null,
      after: string | null,
    ) => {
      startLoading()
      try {
        const existing = tasks.value.find((t) => t.num === num)
        if (!existing) return

        if (existing.status !== toStatus) {
          await postTask({ ...existing, status: toStatus })
        }

        await postTaskRank(num, before, after)
        await init()
      } finally {
        stopLoading()
      }
    }

    const taskDetails = computed(() => (num: string): TaskDetails[] => {
      const task = tasks.value.find((t) => t.num === num) || null
      const result: TaskDetails[] = []
      if (!task) return result
      if (task.parent_num) result.push({ value: task.parent_num, label: 'parent.task' })

      if (task.due) {
        result.push({
          value: task.due,
          label: 'due.date',
          color: task.due_details.format.color,
        })
      }
      if (task.priority)
        result.push({
          value: priorities.value.find((p) => p.value === task.priority)?.title || task.priority,
          label: 'priority',
          color: priorities.value.find((p) => p.value === task.priority)?.attrs.format.color || '',
        })
      if (task.estimated && task.estimated > 0) {
        const units = board.value?.settings.units || 'units'
        result.push({
          value: `${task.estimated} ${units}`,
          label: 'estimated.effort',
        })
      }
      if (task.assignee?.value)
        result.push({
          value: task.assignee.title,
          label: 'assignee',
        })
      return result
    })

    const getAssignees = async (search: string = '') => {
      const { data } = await http.get<{ assignees: { value: string; title: string }[] }>(
        'tra/assignees/',
        {
          params: { search, offset: 0, limit: 20 },
        },
      )
      return data?.assignees
    }

    type Note = {
      id: number
      num: string
      storage_id: string
      content: string
      file_id: string
      file_name: string
      file_size: number
      assistant: string
      author: string
      author_fullname: string
      created: string
      editor: string
      editor_fullname: string
      modified: string
    }

    const notes = ref<Note[]>([])
    const notesPage = ref(1)
    const notesPerPage = 10
    const notesHasNext = ref(false)

    const getNotes = async (
      search?: string,
      filter?: string,
      offset: number = 0,
      limit: number = notesPerPage + 1,
    ) => {
      const { data } = await http.get<{ notes: Note[] }>('tra/notes/', {
        params: { filter, search, offset, limit },
      })
      const allNotes = data?.notes || []
      notesHasNext.value = allNotes.length > notesPerPage
      notes.value = allNotes.slice(0, notesPerPage)
    }

    const fetchNotesPage = async (num: string, page: number) => {
      notesPage.value = page
      const offset = (page - 1) * notesPerPage
      await getNotes('', `{"num": ["${num}"]}`, offset, notesPerPage + 1)
    }

    const postNote = async (note: OvFormData) => {
      const processedNote = await processFormDataWithFiles(note)
      await http.post<PostTaskResponse>('tra/note/', {
        data: JSON.stringify(processedNote),
      })
      notesPage.value = 1
      await getNotes('', `{"num": ["${note.num}"]}`)
    }

    const downloadFile = async (fileId: string, fileName: string) => {
      const response = await http.get(`tra/download/${fileId}`)
      if (response.status === 200 && response.data) {
        const blob = new Blob([response.data as ArrayBuffer], { type: 'application/octet-stream' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', fileName) // Let server suggest filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    }

    return {
      viewModes,
      viewMode,
      key,
      boards,
      board,
      getBoards,
      statuses,
      priorities,
      postBoard,
      setActiveBoard,
      postTask,
      postTaskStatus,
      postTaskRank,
      postTaskMove,
      taskDetails,
      getAssignees,
      init,
      getTasks,
      tasks,
      boardFilters,
      activeBoardFilters,
      setActiveBoardFilters,
      toggleActiveBoardFilter,
      removeActiveBoardFilter,
      clearActiveBoardFilters,
      getNotes,
      notes,
      notesPage,
      notesPerPage,
      notesHasNext,
      fetchNotesPage,
      postNote,
      downloadFile,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['key', 'viewMode', 'boardFilters'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTravailStore, import.meta.hot))
}

export type TravailStore = ReturnType<typeof useTravailStore>
