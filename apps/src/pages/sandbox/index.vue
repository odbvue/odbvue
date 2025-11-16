<template>
  <v-card :style="cardBackground">
    <v-card-title> <v-icon icon="$mdiMinus" />{{ t('sandbox.title') }} </v-card-title>
    <v-card-subtitle>{{ t('sandbox.description') }}</v-card-subtitle>
    <v-card-text>
      <v-row>
        <v-col>
          <h3 class="mb-4">Alerts & snackbar</h3>
          <v-btn class="ma-1" color="info" @click="app.ui.setInfo('This is info!')"
            >Show Info</v-btn
          >
          <v-btn class="ma-1" color="warning" @click="app.ui.setWarning('This is warning!')"
            >Show Warning</v-btn
          >
          <v-btn class="ma-1" color="error" @click="app.ui.setError('This is error!')"
            >Show Error</v-btn
          >
          <v-btn class="ma-1" color="success" @click="app.ui.setSuccess('This is success!')"
            >Show Success</v-btn
          >
          <v-btn
            class="ma-1"
            color="primary"
            @click="app.ui.setSnack('This is snackbar info!', 3000)"
            >Show Snackbar Info</v-btn
          >
          <v-btn class="ma-1" color="secondary" @click="app.ui.clearMessages()">Clear All</v-btn>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <h3 class="mb-4">loading</h3>
          <v-btn class="ma-1" color="primary" @click="app.ui.startLoading()">Start Loading</v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
  <v-container fluid>
    <h2 class="mb-4">Components</h2>
    <v-row>
      <v-col cols="12" md="6" lg="4" v-for="comp in compontents" :key="comp.to">
        <v-card :to="comp.to">
          <v-card-title><v-icon :icon="comp.icon" />{{ comp.text }}</v-card-title>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
const cardBackground = useCardBackground('#ccccee')
const { t } = useI18n()
const app = useAppStore()

const compontents = ref([{ icon: '$mdiChartLine', to: '/sandbox/sandbox-chart', text: 'Chart' }])
</script>
