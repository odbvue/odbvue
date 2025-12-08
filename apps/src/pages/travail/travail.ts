import { defineStore, acceptHMRUpdate } from 'pinia'

export const useTravailStore = defineStore(
  'travail',
  () => {
    const http = useHttp()

    const { startLoading, stopLoading } = useUiStore()

    type Plan = {
      key: string
      title: string
      description: string
      due_warning_days: number
      statuses: {
        id: string
        name: string
        color: string
        done: boolean
      }[]
      priorities?: {
        id: string
        name: string
        color: string
      }[]
    }

    type Task = {
      num: string
      key: string
      parent_num?: string
      title: string
      description: string
      due: string
      due_color?: string
      status?: {
        id: string
        name: string
        color: string
        done: boolean
      }
      priority?: {
        id: string
        name: string
        color: string
      }
      author_uuid: string
      author: string
      assignee_uuid: string
      assignee: string
      created: string
      modified: string
    }

    type TaskDetails = {
      value: string
      label: string
      color?: string
    }

    const key = ref('TRA')
    const plans = ref<Plan[]>([])
    const plan = ref<Plan | null>(null)
    const tasks = ref<Task[]>([])
    const task = ref<Task | null>(null)

    const init = async () => {
      startLoading()
      await getPlans('', `{"key": ["${key.value}"]}`)
      plan.value = plans.value[0] ?? null
      key.value = plan.value ? plan.value.key : 'TRA'
      await getTasks('', `{"key": ["${key.value}"]}`)
      stopLoading()
    }

    const getPlans = async (
      search?: string,
      filter?: string,
      offset: number = 0,
      limit: number = 10,
    ) => {
      const { data } = await http.get<{ plans: Plan[] }>('tra/plans/', {
        params: { filter, search, offset, limit },
      })
      plans.value = data?.plans || []
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

    const taskDetails = computed(() => (num: string): TaskDetails[] => {
      const task = tasks.value.find((t) => t.num === num) || null
      const result: TaskDetails[] = []
      if (!task) return result
      if (task.parent_num) result.push({ value: task.parent_num, label: 'parent.task' })
      if (task.due) result.push({ value: task.due, label: 'due.date', color: task.due_color })
      if (task.assignee) result.push({ value: task.assignee, label: 'assignee' })
      if (task.status)
        result.push({
          value: task.status.name,
          label: 'status',
          color: task.status.color,
        })
      if (task.priority)
        result.push({
          value: task.priority.name,
          label: 'priority',
          color: task.priority.color,
        })
      return result
    })

    const getTask = async (num: string) => {
      const { data } = await http.get<{ tasks: Task[] }>('tra/tasks/', {
        params: { filter: `{"num": ["${num}"]}`, search: '', offset: 0, limit: 1 },
      })
      return data?.tasks[0]
    }

    const createTask = async (task: OvFormData) => {
      await http.post<{ task: Task }>('tra/task/', task)
      await getTasks()
    }

    type Assignee = {
      uuid: string
      fullname: string
    }

    const getAssignees = async (search: string = '') => {
      const { data } = await http.get<{ assignees: Assignee[] }>('tra/assignees/', {
        params: { search, offset: 0, limit: 20 },
      })
      return (data?.assignees || []).map((a) => ({
        title: a.fullname,
        value: a.uuid,
      }))
    }

    return {
      key,
      plans,
      plan,
      tasks,
      task,
      taskDetails,
      init,
      getPlans,
      getTasks,
      getTask,
      createTask,
      getAssignees,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['key'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTravailStore, import.meta.hot))
}
