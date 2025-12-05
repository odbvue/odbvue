import { defineStore, acceptHMRUpdate } from 'pinia'

export const useTravailStore = defineStore(
  'travail',
  () => {
    const http = useHttp()

    const viewMode = ref('details')

    type Task = {
      key: string
      title: string
      description: string
      due: string
      author_uuid: string
      author: string
      assignee_uuid: string
      assignee: string
      created: string
      modified: string
    }

    const tasks = ref<Task[]>([])

    const getTasks = async (
      filter?: string,
      search?: string,
      offset: number = 0,
      limit: number = 10,
    ) => {
      const { data } = await http.get<{ tasks: Task[] }>('tra/tasks/', {
        params: { filter, search, offset, limit },
      })
      tasks.value = data?.tasks || []
    }

    const createTask = async (task: OvFormData) => {
      await http.post<{ task: Task }>('tra/task/', task)
      await getTasks()
    }

    return {
      viewMode,
      tasks,
      getTasks,
      createTask,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['viewMode'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTravailStore, import.meta.hot))
}
