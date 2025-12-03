<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12" md="6">
        <v-card variant="tonal" color="secondary">
          <v-card-text>
            <v-tabs density="compact" v-model="metric">
              <v-tab v-for="metric in metrics" :key="metric" :value="metric">{{ metric }}</v-tab>
            </v-tabs>

            <v-ov-chart bar :chart-data="chartData" :chart-options="chartOptions" />
          </v-card-text>
          <v-card-actions>
            <v-btn-toggle density="compact" mandatory v-model="period">
              <v-btn size="x-small" v-for="period in periods" :key="period" :value="period">
                {{ period }}
              </v-btn>
            </v-btn-toggle>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-row>
          <v-col cols="12" md="6" v-for="alert in alerts" :key="alert.text">
            <v-card variant="tonal" :color="alert.type">
              <v-card-text>
                {{ t(alert.text) }}
              </v-card-text>
              <v-card-title class="d-flex justify-end">
                {{ alert.value }}
              </v-card-title>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" md="4" sm="6" v-for="widget in widgets" :key="widget.name">
        <v-card
          :style="cardBackground"
          :to="widget.path"
          :color="widget.color"
          :title="widget.name"
          :prepend-icon="widget.icon"
          append-icon="$mdiChevronRight"
          hover
        >
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Admin',
    description: 'Site Administration',
    icon: '$mdiShieldAccount',
    color: '#FFDDDD',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const { t } = useI18n()
const cardBackground = useCardBackground('#ffffee')

const widgets = ref([
  { name: 'Users', path: '/admin/users', icon: '$mdiAccountGroup', color: 'primary' },
  { name: 'Audit Logs', path: '/admin/audit', icon: '$mdiClipboardList', color: 'primary' },
  { name: 'Emails', path: '/admin/emails', icon: '$mdiEmail', color: 'primary' },
  { name: 'Job Scheduler', path: '/admin/jobs', icon: '$mdiCalendarClock', color: 'primary' },
  { name: 'Settings', path: '/admin/settings', icon: '$mdiCog', color: 'primary' },
])

// stats

type StatsData = {
  period_type: string
  period_label: string
  metric_name: string
  metric_value: number
}

const statsData = ref<StatsData[]>([])

const metrics = computed(() => new Set(statsData.value.map((item) => item.metric_name)))
const metric = ref('Errors')

const periods = ['H', 'D', 'W', 'M', 'Q', 'Y']
const period = ref('H')

const chartData = computed(() => {
  const data = statsData.value
    .filter((item) => item.metric_name === metric.value && item.period_type === period.value)
    .map((item) => item.metric_value)
  const labels = statsData.value
    .filter((item) => item.metric_name === metric.value && item.period_type === period.value)
    .map((item) => item.period_label)
  return {
    labels,
    datasets: [
      {
        label: metric.value,
        data,
      },
    ],
  }
})
const chartOptions = ref({
  plugins: {
    legend: {
      display: false,
    },
  },
})

const fetchStats = async () => {
  const { data } = await useHttp()<{ stats: StatsData[] }>('/adm/stats/')
  statsData.value = data?.stats || []
}

// alerts

type Alert = {
  text: string
  value: string
  type: 'error' | 'warning' | 'info' | 'success'
  created: string
}

const alerts = ref<Alert[]>([])

const fetchAlerts = async () => {
  const { data } = await useHttp()<{ alerts: Alert[] }>('/adm/alerts/')
  alerts.value = data?.alerts || []
}

//

onMounted(async () => {
  await Promise.all([fetchStats(), fetchAlerts()])
})
</script>
