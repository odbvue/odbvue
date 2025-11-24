<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" :md="4">
        <h1 class="mb-4">{{ t('sign.up') }}</h1>
        <v-ov-form :options :data :t @submit="submit" />
        <br />
        <br />
        <GoogleLogin :clientId="googleClientId" :callback="callback" />
      </v-col>
    </v-row>
  </v-container>

  <v-ov-dialog v-model="showDialog" scrollable :title="t('consent')">
    <template #content>
      <div class="markdown-body ma-2" v-html="consentHtml"></div>
    </template>
    <template #actions>
      <v-btn @click="handleCancel">{{ t('cancel') }}</v-btn>
      <v-btn variant="flat" @click="handleSubmit">{{ t('accept') }}</v-btn>
    </template>
  </v-ov-dialog>
</template>

<script setup lang="ts">
definePage({ meta: { role: 'guest' } })

const app = useAppStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

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
})

const { showDialog, consentHtml, askConsent, handleSubmit, handleCancel } = useConsent()

const submit = async (newData: typeof data.value) => {
  const consentId = await askConsent()
  if (!consentId) {
    data.value = {
      username: newData.username,
      fullname: newData.fullname,
      password: '',
      password2: '',
    }
    return
  }
  const signupResponse = await app.auth.signup(
    newData.username,
    newData.password,
    newData.fullname,
    consentId,
  )
  options.value.errors = signupResponse?.errors || []
  if (!signupResponse?.error && !signupResponse?.errors) {
    router.push((route.query.redirect as string) || '/')
  } else {
    data.value = {
      username: newData.username,
      fullname: newData.fullname,
      password: '',
      password2: '',
    }
  }
}

import { GoogleLogin } from 'vue3-google-login'
import { decodeCredential, type CallbackTypes } from 'vue3-google-login'
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const callback = async (response: CallbackTypes.CredentialPopupResponse) => {
  const consentId = await askConsent()
  if (!consentId) {
    return
  }
  const userData = decodeCredential(response.credential) as {
    email: string
    sub: string
    name: string
  }
  const signupResponse = await app.auth.signup(
    userData.email,
    `GoogleOAuth2.0${userData.sub}`,
    userData.name,
    consentId,
  )
  options.value.errors = signupResponse?.errors || []
  if (!signupResponse?.error && !signupResponse?.errors) {
    router.push((route.query.redirect as string) || '/')
  }
}
</script>
