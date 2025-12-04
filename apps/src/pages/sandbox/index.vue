<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h2 class="mb-4">UI Features</h2>
        <v-card
          prepend-icon="$mdiMinus"
          :style="cardBackground"
          :title="t('sandbox.title')"
          :subtitle="t('sandbox.description')"
        >
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
        <v-card
          :to="comp.to"
          :style="cardBackgroundComponents"
          :prepend-icon="comp.icon"
          :title="comp.title"
          :text="comp.text"
          class="pa-4 h-100"
          hover
        />
      </v-col>
    </v-row>
  </v-container>
  <v-container fluid>
    <h2 class="mb-4">API</h2>
    <v-row>
      <v-col cols="12">
        <v-btn @click="postHeartbeat()">{{ heartbeatStatus }}</v-btn>
      </v-col>
    </v-row>
  </v-container>
  <v-container fluid>
    <h2 class="mb-4">Audit</h2>
    <v-row>
      <v-col cols="12">
        <v-card class="mt-6">
          <v-card-title>Test audit</v-card-title>
          <v-card-text
            >Test audit capabilities. In stash: <strong>{{ app.audit.count }}</strong></v-card-text
          >
          <v-card-actions>
            <v-btn
              color="info"
              @click="app.audit.inf('This is info message', 'This is info message details')"
              >Test info</v-btn
            >
            <v-btn
              color="warning"
              @click="app.audit.wrn('This is warning message', 'This is warning message details')"
              >Test warning</v-btn
            >
            <v-btn color="error" @click="error()">Test error</v-btn>
            <v-spacer></v-spacer>
            <v-btn @click="app.audit.save()">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
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

const cardBackground = useCardBackground('#ccccee')
const cardBackgroundComponents = useCardBackground('#eeeedd')
const { t } = useI18n()
const app = useAppStore()

const heartbeatStatus = ref('Status: N/A')
const api = useHttp()
const postHeartbeat = async () => {
  const { status } = await api.post('app/heartbeat/')
  heartbeatStatus.value = `Status: ${status}`
}

function error() {
  throw new Error('This is an error')
}

const compontents = ref([
  {
    icon: '$mdiChartLine',
    to: '/sandbox/sandbox-chart',
    title: 'Chart',
    text: 'Universal wrapper component for rendering Chart.js charts with responsive resizing and click handling',
  },
  {
    icon: '$mdiCard',
    to: '/sandbox/sandbox-dialog',
    title: 'Dialog',
    text: 'Modal dialog component with customizable title, content, actions, and layout options. Built on Vuetify Dialog component with support for persistent, fullscreen, and scrollable modes',
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
  {
    icon: '$mdiTable',
    to: '/sandbox/sandbox-table',
    title: 'Table',
    text: 'Powerful data table component with integrated search, filtering, sorting, pagination, and row/table-level actions. Supports responsive mobile layout, custom cell formatting, and inline editing with modal forms',
  },
  {
    icon: '$mdiViewDashboard',
    to: '/sandbox/sandbox-view',
    title: 'View',
    text: 'Lightweight display component for rendering structured data with conditional formatting, icons, labels, and item-level actions. Perfect for presenting read-only details or quick-access data with visual enhancements',
  },
])
</script>
