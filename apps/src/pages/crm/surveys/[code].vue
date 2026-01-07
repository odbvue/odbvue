<template>
  <v-container fluid>
    <v-tabs v-model="tab">
      <v-tab value="details">{{ t('details') }}</v-tab>
      <v-tab value="questions">{{ t('questions') }}</v-tab>
    </v-tabs>

    <v-tabs-window v-model="tab">
      <v-tabs-window-item value="details">
        <v-ov-form
          :options="formOptions"
          :data="surveyData"
          :loading="formLoading"
          :t="t"
          @submit="handleFormSubmit"
          @cancel="handleFormCancel"
        />
      </v-tabs-window-item>

      <v-tabs-window-item value="questions">
        <v-ov-table
          :options="questionsOptions"
          :data="questionsData"
          :loading="questionsLoading"
          @fetch="fetchQuestions"
          @action="handleQuestionAction"
        />
      </v-tabs-window-item>
    </v-tabs-window>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Survey',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['crm'],
  },
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const code = computed(() =>
  'code' in route.params
    ? Array.isArray(route.params.code)
      ? route.params.code[0]
      : route.params.code
    : '',
)

const tab = ref('details')

// Survey form
const surveyData = ref<OvFormData>({})
const formLoading = ref(false)

const loadSurvey = async () => {
  if (!code.value) return
  formLoading.value = true
  try {
    const http = useHttp()
    const { data } = await http.get<{ surveys: OvFormData[] }>('crm/surveys/', {
      params: {
        filter: encodeURIComponent(JSON.stringify({ code: [code.value] })),
        limit: 1,
        offset: 0,
      },
    })
    if (data?.surveys?.[0]) {
      surveyData.value = {
        ...data.surveys[0],
        active: data.surveys[0].active === 'Y',
      }
      useNavigationStore().breadcrumb = surveyData.value.title as string
    }
  } finally {
    formLoading.value = false
  }
}

onMounted(loadSurvey)

onUnmounted(() => {
  useNavigationStore().breadcrumb = ''
})

const formOptions = ref<OvFormOptions>({
  cols: 2,
  fields: [
    { name: 'title', type: 'text', label: 'title', required: true },
    { name: 'description', type: 'textarea', label: 'description' },
    { name: 'validFrom', type: 'datetime', label: 'valid.from' },
    { name: 'validTo', type: 'datetime', label: 'valid.to' },
    { name: 'active', type: 'switch', label: 'active' },
  ],
  actions: [{ name: 'cancel', format: { variant: 'outlined' } }, { name: 'submit' }],
  actionSubmit: 'submit',
  actionCancel: 'cancel',
})

const handleFormCancel = () => {
  router.push('/crm/surveys')
}

const handleFormSubmit = async (formData: OvFormData) => {
  formLoading.value = true
  try {
    const http = useHttp()
    const payload = {
      survey: code.value,
      title: formData.title,
      description: formData.description,
      validFrom: formData.validFrom,
      validTo: formData.validTo,
      active: formData.active === true || formData.active === 'Y' ? 'Y' : 'N',
    }
    const { data } = await http.post<{ code: string; errors?: OvFormFieldError[] }>(
      'crm/survey/',
      payload,
    )
    if (data?.errors) {
      // Handle errors - would be shown by form
    } else {
      await loadSurvey()
    }
  } finally {
    formLoading.value = false
  }
}

// Questions table
type QuestionsResponse = {
  questions: OvTableData[]
}

const {
  loading: questionsLoading,
  data: questionsData,
  fetch: fetchQuestionsBase,
} = useTableFetch<QuestionsResponse>({
  endpoint: 'crm/surveys-questions/',
  responseKey: 'questions',
  filter: { code: [code.value] },
})

const fetchQuestions = async (
  fetchData: OvTableData[],
  offset: number,
  limit: number,
  search: string,
  filter: OvFilterValue,
  sort: string,
) => {
  await fetchQuestionsBase(
    fetchData,
    offset,
    limit,
    search,
    { ...filter, code: [code.value] },
    sort,
  )
}

const questionTypes = [
  { title: 'Free Text', value: 'free text' },
  { title: 'Number', value: 'number' },
  { title: 'Single Choice', value: 'single choice' },
  { title: 'Multiple Choices', value: 'multiple choices' },
  { title: 'Rating (1-5)', value: 'rating 5' },
  { title: 'None (Text only)', value: 'none' },
]

const questionsOptions = computed<OvTableOptions>(() => ({
  key: 'id',
  columns: [
    { name: 'position' },
    { name: 'question', maxLength: 50 },
    { name: 'type' },
    {
      name: 'required',
      format: [
        { rules: { type: 'equals', params: 'Y' }, color: 'success', icon: '$mdiCheck' },
        { rules: { type: 'equals', params: 'N' }, color: 'grey', icon: '$mdiMinus' },
      ],
    },
    {
      name: 'actions',
      label: '',
      actions: [
        {
          name: 'edit',
          key: 'id',
          format: { icon: '$mdiPencil' },
          form: {
            cols: 1,
            fields: [
              { name: 'question', type: 'markdown', label: 'question', required: true },
              {
                name: 'type',
                type: 'select',
                label: 'type',
                items: questionTypes,
              },
              { name: 'required', type: 'switch', label: 'required' },
            ],
            actions: [{ name: 'cancel', format: { variant: 'outlined' } }, { name: 'submit' }],
            actionSubmit: 'submit',
            actionCancel: 'cancel',
          },
        },
        {
          name: 'up',
          key: 'id',
          format: { icon: '$mdiArrowUp' },
        },
        {
          name: 'down',
          key: 'id',
          format: { icon: '$mdiArrowDown' },
        },
        {
          name: 'delete',
          key: 'id',
          format: { icon: '$mdiDelete', color: 'error' },
        },
      ],
    },
  ],
  maxLength: 50,
  actions: [
    {
      name: 'add',
      format: { icon: '$mdiPlus', color: 'primary' },
      form: {
        cols: 1,
        fields: [
          { name: 'question', type: 'markdown', label: 'question', required: true },
          {
            name: 'type',
            type: 'select',
            label: 'type',
            items: questionTypes,
            value: 'free text',
          },
          { name: 'required', type: 'switch', label: 'required' },
        ],
        actions: [{ name: 'cancel', format: { variant: 'outlined' } }, { name: 'submit' }],
        actionSubmit: 'submit',
        actionCancel: 'cancel',
      },
    },
  ],
}))

const handleQuestionAction = async (
  name: string,
  data: OvFormData | OvFormData[],
  value?: OvFormData,
  callback?: (errors?: OvFormFieldError[], shouldRefetch?: boolean) => void,
) => {
  const http = useHttp()
  // For add action, data is array and value is form data
  // For row actions (edit, up, down, delete), data is array but value is form data or undefined
  const item = Array.isArray(data) ? value || {} : data

  try {
    if (name === 'add') {
      const payload = {
        survey: code.value,
        id: null,
        position: null,
        question: value?.question,
        type: value?.type || 'free text',
        required: value?.required ? 'Y' : 'N',
      }
      const { data: respData } = await http.post<{ id: number; errors?: OvFormFieldError[] }>(
        'crm/survey-question/',
        payload,
      )
      if (respData?.errors) {
        callback?.(respData.errors, false)
      } else {
        callback?.(undefined, true)
      }
    } else if (name === 'edit') {
      const payload = {
        survey: code.value,
        id: item.id,
        position: item.position,
        question: value?.question || item.question,
        type: value?.type || item.type || 'free text',
        required: (value?.required ?? item.required === 'Y') ? 'Y' : 'N',
      }
      const { data: respData } = await http.post<{ id: number; errors?: OvFormFieldError[] }>(
        'crm/survey-question/',
        payload,
      )
      if (respData?.errors) {
        callback?.(respData.errors, false)
      } else {
        callback?.(undefined, true)
      }
    } else if (name === 'up') {
      await http.post('crm/survey-question-up/', { id: item.id })
      callback?.(undefined, true)
    } else if (name === 'down') {
      await http.post('crm/survey-question-down/', { id: item.id })
      callback?.(undefined, true)
    } else if (name === 'delete') {
      await http.post('crm/survey-question-delete/', { id: item.id })
      callback?.(undefined, true)
    } else {
      callback?.()
    }
  } catch {
    callback?.()
  }
}
</script>
