<template>
  <v-container>
    <v-row align="center">
      <v-col cols="12" md>
        <h3>HTTP laboratory</h3>
        <p class="text-medium-emphasis">Deterministic in-memory endpoints for client behavior.</p>
      </v-col>
      <v-col cols="auto">
        <v-chip :color="network.online.value ? 'success' : 'error'" prepend-icon="$mdiNetwork">
          {{ network.online.value ? 'Browser online' : 'Browser offline' }}
        </v-chip>
      </v-col>
    </v-row>

    <v-row class="mt-2">
      <v-col v-for="scenario in scenarios" :key="scenario.name" cols="12" md="6" lg="4">
        <v-card class="h-100">
          <v-card-item :prepend-icon="scenario.icon" :title="scenario.title" />
          <v-card-text>{{ scenario.description }}</v-card-text>
          <v-card-actions>
            <v-btn :loading="running === scenario.name" color="primary" @click="run(scenario.name)">
              Run
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12" md="4">
        <v-card title="Counters" class="h-100">
          <v-list density="compact">
            <v-list-item title="Requests" :subtitle="String(requestCount)" />
            <v-list-item title="Refreshes" :subtitle="String(refreshCount)" />
            <v-list-item title="Slow requests" :subtitle="String(slowRequestCount)" />
          </v-list>
        </v-card>
      </v-col>
      <v-col cols="12" md="8">
        <v-card title="Latest result" class="h-100">
          <v-card-text>
            <pre class="result">{{ latestResult }}</pre>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { configureHttp, useHttp, useNetwork } from '@odbvue/web'
import { ref } from 'vue'

definePage({
  meta: {
    title: 'HTTP',
    icon: '$mdiNetwork',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

type ScenarioName = 'success' | 'slow' | 'retry' | 'refresh' | 'concurrent' | 'network'

const requestCount = ref(0)
const refreshCount = ref(0)
const slowRequestCount = ref(0)
const running = ref<ScenarioName>()
const latestResult = ref('Run a scenario to inspect its response.')
const network = useNetwork()
let accessToken = 'expired'
let retryAttempts = 0

const scenarios: Array<{
  name: ScenarioName
  title: string
  description: string
  icon: string
}> = [
  {
    name: 'success',
    title: 'Success',
    description: 'A normal 200 response with headers.',
    icon: '$mdiCheckCircle',
  },
  {
    name: 'slow',
    title: 'Slow request',
    description: 'A delayed response that triggers the slow hook.',
    icon: '$mdiTimerSand',
  },
  {
    name: 'retry',
    title: 'Retry',
    description: 'Two 503 responses, then a successful retry.',
    icon: '$mdiReload',
  },
  {
    name: 'refresh',
    title: 'Refresh token',
    description: 'A 401 response followed by one token refresh.',
    icon: '$mdiKeyChange',
  },
  {
    name: 'concurrent',
    title: 'Concurrent refresh',
    description: 'Ten 401 requests sharing one refresh.',
    icon: '$mdiAccountGroup',
  },
  {
    name: 'network',
    title: 'Network failure',
    description: 'A request with no HTTP response.',
    icon: '$mdiWifiOff',
  },
]

configureHttp({
  getAccessToken: () => accessToken,
  refreshAccessToken: async () => {
    refreshCount.value += 1
    await delay(100)
    accessToken = 'fresh'
    return true
  },
  slowRequestThresholdMs: 500,
  onSlowRequest: () => {
    slowRequestCount.value += 1
  },
})

const http = useHttp({ fetch: laboratoryFetch })

async function run(scenario: ScenarioName) {
  running.value = scenario
  try {
    if (scenario === 'concurrent') {
      accessToken = 'expired'
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => http.get('/laboratory/auth')),
      )
      latestResult.value = JSON.stringify(
        { statuses: responses.map((response) => response.status) },
        null,
        2,
      )
      return
    }

    if (scenario === 'retry') retryAttempts = 0
    if (scenario === 'refresh') accessToken = 'expired'
    const response = await http.get(`/laboratory/${scenario}`)
    latestResult.value = JSON.stringify(
      {
        status: response.status,
        data: response.data,
        error: response.error && { message: response.error.message, status: response.error.status },
        requestId: response.headers?.get('X-Request-Id'),
      },
      null,
      2,
    )
  } finally {
    running.value = undefined
  }
}

async function laboratoryFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  requestCount.value += 1
  const requestUrl = input instanceof Request ? input.url : input.toString()
  const url = new URL(requestUrl, window.location.origin)
  if (url.pathname.endsWith('/network')) throw new TypeError('Simulated network failure')
  if (url.pathname.endsWith('/slow')) await delay(650)
  if (url.pathname.endsWith('/retry') && retryAttempts++ < 2)
    return createResponse(503, { error: 'Try again' })
  if (
    url.pathname.endsWith('/auth') &&
    new Headers(init?.headers).get('Authorization') !== 'Bearer fresh'
  )
    return createResponse(401, { error: 'Expired token' })
  return createResponse(200, { ok: true, path: url.pathname })
}

function createResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': crypto.randomUUID() },
  })
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
</script>

<style scoped>
.result {
  min-height: 8rem;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
