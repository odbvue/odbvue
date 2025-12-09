import { defineStore, acceptHMRUpdate } from 'pinia'
import type { OvFormFieldError } from '@/components/index.ts'

export type PostTaskResponse = {
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

      parent_num?: string
    }

    type TaskDetails = {
      value: string
      label: string
      color?: string
    }

    const viewModes = ['board', 'calendar'] as const
    const viewMode = ref('board')

    const boards = ref<Board[]>([])
    const board = ref<Board | null>(null)
    const key = ref('TRA')

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

    return {
      viewModes,
      viewMode,
      key,
      boards,
      board,
      getBoards,
      statuses,
      priorities,
      postTask,
      taskDetails,
      getAssignees,
      init,
      getTasks,
      tasks,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['key', 'viewMode'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTravailStore, import.meta.hot))
}
