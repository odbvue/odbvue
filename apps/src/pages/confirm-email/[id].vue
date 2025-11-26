<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" :md="4">
        <h1 class="mb-4">{{ t('email.confirmation') }}</h1>
        <v-btn @click="router.push('/')">{{ t('ok') }}</v-btn>
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
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

onMounted(async () => {
  const token = (route.params as { id: string }).id
  await authStore.confirmEmail(token)
})
</script>
