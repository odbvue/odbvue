<template>
  <v-card prepend-icon="$mdiHome" :title="t('sandbox.title')">
    <v-card-text>{{ t('sandbox.description') }}</v-card-text>
    <v-card-actions>
      <v-btn @click="app.settings.toggleTheme()">Toggle theme</v-btn>
      <v-btn color="info" @click="app.ui.setInfo('Info message')">Info</v-btn>
      <v-btn color="info" @click="app.ui.setInfo('Info message 2 sec', { timeout: 2000 })"
        >Info 2 sec</v-btn
      >
      <v-btn color="info" @click="app.ui.setInfo('Info message clear', { onRouteChange: 'clear' })"
        >Info clear</v-btn
      >
      <v-btn color="success" @click="app.ui.setSuccess('Success message')">Success</v-btn>
      <v-btn color="warning" @click="app.ui.setWarning('Warning message')">Warning</v-btn>
      <v-btn color="error" @click="app.ui.setError('Error message')">Error</v-btn>
      <v-btn color="primary" @click="app.ui.setSnack('Snackbar message')">Snackbar</v-btn>
      <v-btn color="secondary" @click="app.ui.clearAll()">Clear All</v-btn>
      <v-btn color="secondary" @click="app.ui.startLoading()">Loading</v-btn>
    </v-card-actions>
  </v-card>
  <test-component />
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Sandbox',
    description: 'A sandbox page to test various UI components and features',
    icon: '$mdiFlask',
    color: '#DDEEFF',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const app = useAppStore()
const { t } = useI18n()
</script>
