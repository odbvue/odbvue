<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h2 class="mb-4">UI Features</h2>
        <v-card :style="cardBackground">
          <v-card-title> <v-icon icon="$mdiMinus" />{{ t('sandbox.title') }} </v-card-title>
          <v-card-subtitle>{{ t('sandbox.description') }}</v-card-subtitle>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="10">
                <h3 class="ma-2">Alerts & snackbar</h3>
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
                <v-btn class="ma-1" color="secondary" @click="app.ui.clearMessages()"
                  >Clear All</v-btn
                >
              </v-col>
              <v-col cols="12" md="2">
                <h3 class="ma-2">Loading</h3>
                <v-btn class="ma-1" color="primary" @click="app.ui.startLoading()"
                  >Start Loading</v-btn
                >
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
  <v-container fluid>
    <h2 class="mb-4">UI Components</h2>
    <v-row>
      <v-col cols="12" md="6" lg="4" v-for="comp in compontents" :key="comp.to">
        <v-card :to="comp.to" :style="cardBackgroundComponents" class="pa-4 h-100" hover>
          <v-card-title><v-icon :icon="comp.icon" class="mr-2" />{{ comp.title }}</v-card-title>
          <v-card-text>{{ comp.text }}</v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
const cardBackground = useCardBackground('#ccccee')
const cardBackgroundComponents = useCardBackground('#eeeedd')
const { t } = useI18n()
const app = useAppStore()

const compontents = ref([
  {
    icon: '$mdiChartLine',
    to: '/sandbox/sandbox-chart',
    title: 'Chart',
    text: 'Universal wrapper component for rendering Chart.js charts with responsive resizing and click handling',
  },
  {
    icon: '$mdiPen',
    to: '/sandbox/sandbox-editor',
    title: 'Editor',
    text: 'Rich text editor component powered by TipTap with configurable formatting toolbar and HTML/Markdown conversion',
  },
  {
    icon: '$mdiFormTextarea',
    to: '/sandbox/sandbox-form',
    title: 'Form',
    text: 'Flexible form component with built-in validation, customizable fields, and action handling. Supports text, email, password, textarea, number, select, checkbox, switch, rating, file, and date/time inputs',
  },
  {
    icon: '$mdiMap',
    to: '/sandbox/sandbox-map',
    title: 'Map',
    text: 'Interactive map component powered by Google Maps with marker management, geolocation support, and customizable center/zoom controls',
  },
  {
    icon: '$mdiMusic',
    to: '/sandbox/sandbox-media',
    title: 'Media',
    text: 'Universal media component for video playback, video recording, audio playback, and audio recording with device management and snapshot capture',
  },
  {
    icon: '$mdiDraw',
    to: '/sandbox/sandbox-pad',
    title: 'Pad',
    text: 'Interactive drawing and sketching component with support for multiple stroke types, shapes, colors, and undo/redo functionality',
  },
  {
    icon: '$mdiShare',
    to: '/sandbox/sandbox-share',
    title: 'Share',
    text: 'Social media sharing and clipboard functionality component with support for multiple platforms and customizable button styling',
  },
])
</script>
