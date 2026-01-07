<template>
  <v-container class="fill-height">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <!-- Loading State -->
        <v-card v-if="loading" class="pa-6">
          <v-card-text class="text-center">
            <v-progress-circular indeterminate size="48" color="primary" />
          </v-card-text>
        </v-card>

        <!-- Error State -->
        <v-card v-else-if="error" class="pa-6">
          <v-card-text class="text-center">
            <v-icon size="64" color="error">$mdiAlertCircle</v-icon>
            <p class="text-h6 mt-4">{{ error }}</p>
            <v-btn color="primary" to="/" class="mt-4">{{ t('home') }}</v-btn>
          </v-card-text>
        </v-card>

        <!-- Submitted State -->
        <v-card v-else-if="submitted" class="pa-6">
          <v-card-text class="text-center">
            <v-icon size="64" color="success">$mdiCheckCircle</v-icon>
            <p class="text-h5 mt-4">{{ t('thank.you') }}</p>
            <p class="text-body-1 mt-2">{{ t('survey.submitted') }}</p>
            <v-btn color="primary" to="/" class="mt-4">{{ t('home') }}</v-btn>
          </v-card-text>
        </v-card>

        <!-- Survey Form -->
        <v-card v-else-if="survey && questions.length > 0">
          <v-card-title class="text-h5">{{ survey.title }}</v-card-title>
          <v-card-subtitle v-if="survey.description">{{ survey.description }}</v-card-subtitle>

          <v-card-text>
            <!-- Current Question -->
            <div v-if="currentQuestion" class="mb-6">
              <!-- Question Text (Markdown) -->
              <div class="text-body-1 mb-4" v-html="renderMarkdown(currentQuestion.question)" />

              <!-- Answer Input based on type -->
              <template v-if="currentQuestion.type !== 'none'">
                <!-- Free Text -->
                <v-textarea
                  v-if="currentQuestion.type === 'free text'"
                  v-model="responses[currentQuestion.id]"
                  :label="t('your.answer')"
                  rows="3"
                  variant="outlined"
                  :rules="currentQuestion.required === 'Y' ? [requiredRule] : []"
                />

                <!-- Number -->
                <v-text-field
                  v-else-if="currentQuestion.type === 'number'"
                  v-model.number="responses[currentQuestion.id]"
                  :label="t('your.answer')"
                  type="number"
                  variant="outlined"
                  :rules="currentQuestion.required === 'Y' ? [requiredRule] : []"
                />

                <!-- Single Choice -->
                <v-radio-group
                  v-else-if="currentQuestion.type === 'single choice'"
                  v-model="responses[currentQuestion.id]"
                  :rules="currentQuestion.required === 'Y' ? [requiredRule] : []"
                >
                  <v-radio
                    v-for="(choice, idx) in getChoices(currentQuestion.question)"
                    :key="idx"
                    :label="choice"
                    :value="choice"
                  />
                </v-radio-group>

                <!-- Multiple Choices -->
                <div v-else-if="currentQuestion.type === 'multiple choices'">
                  <v-checkbox
                    v-for="(choice, idx) in getChoices(currentQuestion.question)"
                    :key="idx"
                    v-model="multipleChoices[currentQuestion.id]"
                    :label="choice"
                    :value="choice"
                    hide-details
                    density="compact"
                  />
                </div>

                <!-- Rating 5 -->
                <div v-else-if="currentQuestion.type === 'rating 5'" class="text-center">
                  <v-rating
                    v-model="responses[currentQuestion.id]"
                    :length="5"
                    :size="48"
                    color="warning"
                    active-color="warning"
                    hover
                  />
                </div>
              </template>

              <!-- Required indicator -->
              <p
                v-if="currentQuestion.required === 'Y' && currentQuestion.type !== 'none'"
                class="text-caption text-error mt-2"
              >
                * {{ t('required') }}
              </p>
            </div>
          </v-card-text>

          <v-card-actions class="justify-space-between pa-4">
            <v-btn v-if="currentIndex > 0" variant="outlined" @click="prevQuestion">
              {{ t('prev') }}
            </v-btn>
            <v-spacer v-else />

            <v-btn
              v-if="currentIndex < questions.length - 1"
              color="primary"
              :disabled="!canProceed"
              @click="nextQuestion"
            >
              {{ t('next') }}
            </v-btn>
            <v-btn
              v-else
              color="primary"
              :disabled="!canProceed"
              :loading="submitting"
              @click="submitSurvey"
            >
              {{ t('finish') }}
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- No Questions -->
        <v-card v-else-if="survey" class="pa-6">
          <v-card-text class="text-center">
            <v-icon size="64" color="warning">$mdiAlertCircle</v-icon>
            <p class="text-h6 mt-4">{{ t('no.questions') }}</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()

definePage({
  meta: {
    title: 'Survey',
    visibility: 'none',
    access: 'always',
  },
})

const { t } = useI18n()
const route = useRoute()

const code = computed(() =>
  'code' in route.params
    ? Array.isArray(route.params.code)
      ? route.params.code[0]
      : route.params.code
    : '',
)

interface Survey {
  code: string
  title: string
  description?: string
}

interface Question {
  code: string
  id: number
  position: number
  question: string
  type: string
  required: string
}

const loading = ref(true)
const error = ref<string | null>(null)
const submitted = ref(false)
const submitting = ref(false)

const survey = ref<Survey | null>(null)
const questions = ref<Question[]>([])

const currentIndex = ref(0)
const responses = ref<Record<number, string | number>>({})
const multipleChoices = ref<Record<number, string[]>>({})

const currentQuestion = computed(() => questions.value[currentIndex.value])

const requiredRule = (v: unknown) => {
  if (v === null || v === undefined || v === '') return t('field.required')
  return true
}

const canProceed = computed(() => {
  const q = currentQuestion.value
  if (!q) return true
  if (q.type === 'none') return true
  if (q.required !== 'Y') return true

  if (q.type === 'multiple choices') {
    const selected = multipleChoices.value[q.id]
    return selected && selected.length > 0
  }

  const answer = responses.value[q.id]
  return answer !== null && answer !== undefined && answer !== ''
})

const renderMarkdown = (text: string): string => {
  if (!text) return ''
  // For choice types, only render the first line (the question)
  const lines = text.split('\n')
  const questionText = lines[0] || ''
  return md.render(questionText)
}

const getChoices = (text: string): string[] => {
  if (!text) return []
  const lines = text.split('\n')
  // Skip first line (question text), return rest as choices
  return lines.slice(1).filter((line) => line.trim())
}

const loadSurvey = async () => {
  loading.value = true
  error.value = null

  try {
    const http = useHttp()

    // Fetch questions using public endpoint (includes code in each row)
    const { data } = await http.get<{ questions: Question[] }>('crm/survey-questions/', {
      params: { survey: code.value },
    })

    if (!data?.questions?.length) {
      error.value = t('survey.not.found')
      loading.value = false
      return
    }

    questions.value = data.questions
    // Survey info comes from the questions (code is in each row)
    const firstQuestion = data.questions[0]
    if (!firstQuestion) {
      error.value = t('survey.not.found')
      loading.value = false
      return
    }
    survey.value = { code: firstQuestion.code, title: '', description: '' }

    // Initialize multiple choice arrays
    questions.value.forEach((q) => {
      if (q.type === 'multiple choices') {
        multipleChoices.value[q.id] = []
      }
    })
  } catch {
    error.value = t('survey.load.error')
  } finally {
    loading.value = false
  }
}

const prevQuestion = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const nextQuestion = () => {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
  }
}

const submitSurvey = async () => {
  submitting.value = true

  try {
    // Build responses array
    const responsesArray = questions.value
      .filter((q) => q.type !== 'none')
      .map((q) => ({
        id: q.id,
        answer:
          q.type === 'multiple choices'
            ? multipleChoices.value[q.id]?.join(', ')
            : responses.value[q.id],
      }))

    const http = useHttp()
    const { data } = await http.post<{ errors?: { name: string; message: string }[] }>(
      'crm/survey-response/',
      {
        survey: code.value,
        responses: JSON.stringify(responsesArray),
      },
    )

    if (data?.errors && data.errors.length > 0 && data.errors[0]) {
      error.value = data.errors[0].message
    } else {
      submitted.value = true
    }
  } catch {
    error.value = t('survey.submit.error')
  } finally {
    submitting.value = false
  }
}

onMounted(loadSurvey)
</script>
