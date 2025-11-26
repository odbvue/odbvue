<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" :md="4">
        <h1 class="mb-4">{{ t('recover.password') }}</h1>
        <v-ov-form v-if="!sent" :options :data :t @submit="submit" />
        <v-btn v-if="sent" @click="router.push('/')" class="mt-4">{{ t('ok') }}</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'never',
    access: 'when-unauthenticated',
  },
})

const app = useAppStore()
const router = useRouter()
const { t } = useI18n()

const sent = ref(false)

const options = <OvFormOptions>{
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
  ],
  actions: [
    {
      name: 'submit',
      format: { text: 'send' },
    },
  ],
  actionAlign: 'right',
  actionSubmit: 'submit',
}

const data = ref({
  username: '',
})

const submit = async (newData: typeof data.value) => {
  sent.value = await app.auth.recoverPassword(newData.username)
}
</script>
