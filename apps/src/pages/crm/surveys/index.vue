<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-ov-table
          :options="options"
          :data="data"
          :loading="loading"
          @fetch="fetchSurveys"
          @action="handleAction"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Surveys',
    color: '#9C27B0',
    description: 'Manage surveys',
    icon: '$mdiClipboardText',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['crm'],
  },
})

const router = useRouter()
const { t } = useI18n()
const http = useHttp()

type SurveysResponse = {
  surveys: OvTableData[]
}

const {
  loading,
  data,
  fetch: fetchSurveys,
} = useTableFetch<SurveysResponse>({
  endpoint: 'crm/surveys/',
  responseKey: 'surveys',
})

const { action: formAction } = useFormAction({
  endpoints: {
    add: 'crm/survey/',
  },
  refetchOn: ['add'],
  onSuccess: (actionName, payload) => {
    if (actionName === 'add' && payload.code) {
      router.push(`/crm/surveys/${payload.code}`)
    }
  },
})

const handleAction = async (
  name: string,
  item: OvFormData,
  value?: OvFormData,
  callback?: (errors?: OvFormFieldError[], shouldRefetch?: boolean) => void,
) => {
  if (name === 'download' && value?.code) {
    // Download responses using authenticated request
    const response = await http.get(`crm/surveys-responses/?survey=${value.code}`)
    if (response.status === 200 && response.data) {
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `survey_${value.code}_responses.json`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
    callback?.()
  } else {
    await formAction(name, item, value, callback)
  }
}

const options = ref<OvTableOptions>({
  key: 'code',
  search: {
    placeholder: 'title.description',
  },
  columns: [
    { name: 'code' },
    { name: 'title' },
    { name: 'description', maxLength: 50 },
    {
      name: 'active',
      format: [
        {
          rules: { type: 'equals', params: 'Y' },
          color: 'success',
          icon: '$mdiCheck',
          text: 'Active',
        },
        {
          rules: { type: 'equals', params: 'N' },
          color: 'error',
          icon: '$mdiClose',
          text: 'Inactive',
        },
      ],
    },
    { name: 'countQuestions', label: t('questions') },
    { name: 'countResponses', label: t('responses') },
    { name: 'author' },
    { name: 'created' },
    {
      name: 'actions',
      label: '',
      actions: [
        {
          name: 'edit',
          key: 'code',
          format: { icon: '$mdiPencil', to: '/crm/surveys/{{value}}' },
        },
        {
          name: 'download',
          key: 'code',
          format: { icon: '$mdiDownload' },
        },
      ],
    },
  ],
  maxLength: 30,
  actions: [
    {
      name: 'add',
      format: { icon: '$mdiPlus', color: 'primary' },
      form: {
        cols: 1,
        fields: [
          { name: 'title', type: 'text', label: 'title', required: true },
          { name: 'description', type: 'textarea', label: 'description' },
          { name: 'validFrom', type: 'datetime', label: 'valid.from' },
          { name: 'validTo', type: 'datetime', label: 'valid.to' },
        ],
        actions: [{ name: 'cancel', format: { variant: 'outlined' } }, { name: 'submit' }],
        actionSubmit: 'submit',
        actionCancel: 'cancel',
      },
    },
  ],
})
</script>
