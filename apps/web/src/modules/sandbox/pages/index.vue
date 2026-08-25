<template>
  <v-container>
    <v-row
      ><v-col cols="12"><h3>Application features</h3></v-col
      ><v-col cols="12" md="6" v-for="feature in features" :key="feature.to">
        <v-card
          :prepend-icon="feature.icon"
          :title="feature.title"
          :text="feature.text"
          :to="feature.to"
          class="pa-4 h-100"
          hover
        />
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col cols="12"><h3>Available Components</h3></v-col>
      <v-col cols="12" md="6" lg="4" v-for="comp in components" :key="comp.to">
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

const features = ref([
  {
    icon: '$mdiPalette',
    to: '/sandbox/sandbox-ui',
    title: 'UI Feedback',
    text: 'A collection of UI feedback components including alerts, notifications, and progress indicators with customizable styles and behaviors',
  },
  {
    icon: '$mdiDrag',
    to: '/sandbox/sandbox-dnd',
    title: 'Drag and Drop',
    text: 'A drag-and-drop component for rearranging items in a list or grid with support for touch devices and customizable drop zones',
  },
  {
    icon: '$mdiAccountCowboyHat',
    to: '/sandbox/sandbox-http',
    title: 'HTTP Requests',
    text: 'A component for testing HTTP requests and responses with support for GET, POST, PUT, DELETE methods and error handling',
  },
])

const cardBackgroundComponents = useCardBackground('#eeeedd')
const components = ref([
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
