<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" :md="4">
        <h1 class="mb-4">{{ t('sign.up') }}</h1>
        <v-ov-form :options :data :t @submit="submit">
          <template #field-consent>
            <span>
              {{ t('i.agree.to.the') }}
              <a href="#" @click.prevent="showConsent = true">
                {{ t('terms.and.conditions') }}
              </a>
            </span>
          </template>
        </v-ov-form>
      </v-col>
    </v-row>
  </v-container>
  <v-ov-dialog v-model="showConsent" scrollable closeable :title="t('consent')">
    <template #content>
      <div class="markdown-body ma-2" v-html="consentHtml"></div>
    </template>
  </v-ov-dialog>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it'

definePage({ meta: { role: 'guest' } })

const app = useAppStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()

const options = ref(<OvFormOptions>{
  fields: [
    {
      type: 'text',
      name: 'username',
      label: 'username',
      placeholder: 'username',
      rules: [
        { type: 'required', params: true, message: 'username.is.required' },
        { type: 'email', params: true, message: 'username.must.be.a.valid.email.address' },
      ],
    },
    {
      type: 'text',
      name: 'fullname',
      label: 'fullname',
      placeholder: 'fullname',
      rules: [{ type: 'required', params: true, message: 'fullname.is.required' }],
    },
    {
      type: 'password',
      name: 'password',
      label: 'password',
      placeholder: 'Password',
      rules: [{ type: 'required', params: true, message: 'password.is.required' }],
    },
    {
      type: 'password',
      name: 'password2',
      label: 'password.repeat',
      placeholder: 'password.repeat',
      rules: [
        { type: 'required', params: true, message: 'password.is.required' },
        { type: 'same-as', params: 'password', message: 'passwords.must.match' },
      ],
    },
    {
      type: 'checkbox',
      name: 'consent',
      label: 'consent',
      rules: [{ type: 'required', params: true, message: 'consent.is.required' }],
    },
  ],
  actions: [
    {
      name: 'submit',
      format: { text: 'sign.up' },
    },
  ],
  actionAlign: 'right',
  actionSubmit: 'submit',
})

const data = ref({
  username: '',
  fullname: '',
  password: '',
  password2: '',
  consent: '',
})

const submit = async (newData: typeof data.value) => {
  const signupResponse = await app.auth.signup(
    newData.username,
    newData.password,
    newData.fullname,
    consentId.value,
  )
  options.value.errors = signupResponse?.errors || []
  if (!signupResponse?.error && !signupResponse?.errors) {
    router.push((route.query.redirect as string) || '/')
  } else {
    data.value.password = ''
    data.value.password2 = ''
  }
}

const md = new MarkdownIt()
const showConsent = ref(false)
const consentId = ref('')
const consentMd = ref('')
const consentHtml = computed(() => md.render(consentMd.value))

const loadConsent = async () => {
  app.ui.startLoading()
  const foundConsent = app.consents.find((c) => c.language === locale.value)
  if (foundConsent) {
    consentId.value = foundConsent.id
    const { data } = await useHttp().get<{ consent: string }>(`app/consent/${consentId.value}`)
    consentMd.value = data?.consent ?? ''
  }
  app.ui.stopLoading()
}

watchEffect(loadConsent)
</script>
