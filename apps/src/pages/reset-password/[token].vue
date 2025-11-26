<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" :md="4">
        <h1 class="mb-4">{{ t('reset.password') }}</h1>
        <v-ov-form v-if="!done" :options :data :t @submit="submit" />
        <v-btn v-if="done" @click="router.push('/')" class="mt-4">{{ t('continue') }}</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'never',
    access: 'always',
  },
})

const appStore = useAppStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const done = ref(false)

const options = ref<OvFormOptions>({
  fields: [
    {
      type: 'text',
      name: 'username',
      label: 'username',
      placeholder: 'username',
      rules: [
        { type: 'required', params: true, message: 'username.is.required' },
        { type: 'email', params: true, message: 'username.must.be.a.valid.e-mail.address' },
      ],
    },
    {
      type: 'password',
      name: 'password',
      label: 'password',
      placeholder: 'password',
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
  ],
  actions: [
    {
      name: 'submit',
      format: { text: 'reset.password' },
    },
  ],
  actionAlign: 'right',
  actionSubmit: 'submit',
})

const data = ref({
  username: '',
  password: '',
  password2: '',
})

const submit = async (newData: typeof data.value) => {
  const recoverToken = (route.params as { token: string }).token
  const resetResponse = await appStore.auth.resetPassword(
    newData.username,
    newData.password,
    recoverToken,
  )
  options.value.errors = resetResponse?.errors || []
  if (!resetResponse?.error && !resetResponse?.errors) {
    router.push((route.query.redirect as string) || '/')
  } else {
    data.value.password = ''
    data.value.password2 = ''
  }
}
</script>
