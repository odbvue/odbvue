<template>
  <v-container fluid>
    <v-row v-if="loading" justify="center" class="my-8">
      <v-progress-circular indeterminate color="primary" size="64" />
    </v-row>

    <template v-else-if="modules.length > 0">
      <!-- Header Section -->
      <v-row>
        <v-col cols="12">
          <div class="d-flex align-center flex-wrap ga-2">
            <h1 class="text-h4 font-weight-bold">REST API</h1>
          </div>
          <div class="text-body-2 text-medium-emphasis mt-1">[ Base URL: {{ baseUrl }} ]</div>
        </v-col>
      </v-row>

      <!-- Module Sections (app, adm, etc.) -->
      <div v-for="module in modules" :key="module.name" class="mt-6">
        <div class="d-flex align-center mb-3">
          <h2 class="text-h5 font-weight-bold">{{ module.name }}</h2>
          <v-chip
            v-if="module.manifest?.info?.version"
            color="success"
            size="x-small"
            variant="flat"
            class="ml-2"
          >
            {{ module.manifest.info.version }}
          </v-chip>
          <span v-if="module.manifest?.info?.title" class="text-body-2 text-medium-emphasis ml-3">
            {{ module.manifest.info.title }}
          </span>
          <v-progress-circular
            v-if="module.loading"
            indeterminate
            size="16"
            width="2"
            class="ml-3"
          />
        </div>

        <template v-if="module.manifest">
          <!-- Endpoints (accordion - one at a time) -->
          <v-expansion-panels class="swagger-endpoints">
            <v-expansion-panel
              v-for="endpoint in module.endpoints"
              :key="`${module.name}-${endpoint.method}-${endpoint.path}`"
              :value="`${endpoint.method}-${endpoint.path}`"
              :class="['swagger-endpoint', `swagger-endpoint-${endpoint.method.toLowerCase()}`]"
            >
              <v-expansion-panel-title class="py-2 px-3">
                <div class="d-flex align-center flex-grow-1">
                  <v-chip
                    :color="getMethodColor(endpoint.method)"
                    size="small"
                    variant="flat"
                    class="font-weight-bold text-white"
                    style="min-width: 80px; justify-content: center"
                  >
                    {{ endpoint.method }}
                  </v-chip>
                  <span class="font-weight-medium ml-3">{{ endpoint.path }}</span>
                  <span class="text-body-2 text-medium-emphasis ml-4 flex-grow-1">
                    {{ endpoint.summary || endpoint.description }}
                  </span>
                </div>
                <v-icon
                  v-if="endpoint.security"
                  icon="$mdiLock"
                  size="small"
                  class="text-medium-emphasis mr-2"
                />
              </v-expansion-panel-title>

              <v-expansion-panel-text class="swagger-endpoint-content">
                <!-- Description -->
                <div v-if="endpoint.description" class="mb-4">
                  <p class="text-body-1">{{ endpoint.description }}</p>
                </div>

                <!-- Parameters Section -->
                <div v-if="endpoint.parameters?.length" class="mb-4">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Parameters</h4>
                  <v-table density="compact" class="swagger-params-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="param in endpoint.parameters" :key="param.name">
                        <td class="text-no-wrap">
                          <strong>{{ param.name }}</strong>
                          <span v-if="param.required" class="text-error ml-1">*</span>
                          <br />
                          <span class="text-caption text-medium-emphasis">
                            {{ param.schema?.type || 'string' }}
                          </span>
                          <br />
                          <span class="text-caption text-medium-emphasis">({{ param.in }})</span>
                        </td>
                        <td>
                          <span class="text-body-2">{{ param.description || '-' }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>

                <!-- Request Body Section -->
                <div v-if="endpoint.requestBody" class="mb-4">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">
                    Request body
                    <span v-if="endpoint.requestBody.required" class="text-error">*</span>
                  </h4>
                  <v-card variant="outlined">
                    <v-card-text class="pa-0">
                      <pre
                        v-if="endpoint.requestBody.schema"
                        class="text-body-2 pa-3 ma-0"
                        style="overflow-x: auto; background: rgba(0, 0, 0, 0.05)"
                        >{{ formatSchema(endpoint.requestBody.schema) }}</pre
                      >
                    </v-card-text>
                  </v-card>
                </div>

                <!-- Responses Section -->
                <div v-if="endpoint.responses?.length" class="mb-4">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Responses</h4>
                  <v-table density="compact" class="swagger-responses-table">
                    <thead>
                      <tr>
                        <th style="width: 100px">Code</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="response in endpoint.responses" :key="response.code">
                        <td>
                          <v-chip
                            :color="getResponseColor(response.code)"
                            size="small"
                            variant="flat"
                          >
                            {{ response.code }}
                          </v-chip>
                        </td>
                        <td>
                          <span class="text-body-2">{{ response.description || '-' }}</span>
                          <div v-if="response.schema" class="mt-2">
                            <pre
                              class="text-body-2 pa-2 rounded"
                              style="
                                overflow-x: auto;
                                background: rgba(0, 0, 0, 0.05);
                                font-size: 12px;
                              "
                              >{{ formatSchema(response.schema) }}</pre
                            >
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>

                <v-divider class="my-4" />

                <!-- Try it out Section -->
                <div>
                  <h4 class="text-subtitle-1 font-weight-bold mb-3">Try it out</h4>

                  <v-row dense>
                    <v-col
                      v-for="param in getPathParams(endpoint)"
                      :key="param.name"
                      cols="12"
                      md="6"
                    >
                      <v-text-field
                        v-model="
                          paramValues[
                            `${module.name}-${endpoint.method}-${endpoint.path}-${param.name}`
                          ]
                        "
                        :label="`${param.name}${param.required ? ' *' : ''}`"
                        :placeholder="param.description"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="mb-2"
                      />
                    </v-col>

                    <v-col
                      v-for="param in getQueryParams(endpoint)"
                      :key="param.name"
                      cols="12"
                      md="6"
                    >
                      <v-text-field
                        v-model="
                          paramValues[
                            `${module.name}-${endpoint.method}-${endpoint.path}-${param.name}`
                          ]
                        "
                        :label="`${param.name}${param.required ? ' *' : ''}`"
                        :placeholder="param.description"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="mb-2"
                      />
                    </v-col>
                  </v-row>

                  <v-textarea
                    v-if="endpoint.requestBody"
                    v-model="requestBodies[`${module.name}-${endpoint.method}-${endpoint.path}`]"
                    label="Request Body (JSON)"
                    rows="4"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="mb-3"
                  />

                  <div class="d-flex ga-2">
                    <v-btn
                      color="primary"
                      variant="flat"
                      :loading="
                        executingEndpoint === `${module.name}-${endpoint.method}-${endpoint.path}`
                      "
                      @click="executeRequest(module, endpoint)"
                    >
                      Execute
                    </v-btn>

                    <v-btn
                      v-if="results[`${module.name}-${endpoint.method}-${endpoint.path}`]"
                      variant="outlined"
                      @click="clearResult(module, endpoint)"
                    >
                      Clear
                    </v-btn>
                  </div>
                </div>

                <!-- Response Result -->
                <div
                  v-if="results[`${module.name}-${endpoint.method}-${endpoint.path}`]"
                  class="mt-4"
                >
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">
                    Server response
                    <v-chip
                      :color="
                        getResponseColor(
                          results[`${module.name}-${endpoint.method}-${endpoint.path}`]?.status ??
                            0,
                        )
                      "
                      size="small"
                      variant="flat"
                      class="ml-2"
                    >
                      {{ results[`${module.name}-${endpoint.method}-${endpoint.path}`]?.status }}
                    </v-chip>
                  </h4>
                  <v-card variant="outlined">
                    <v-card-text class="pa-0">
                      <pre
                        class="text-body-2 pa-3 ma-0"
                        style="overflow-x: auto; max-height: 400px; background: rgba(0, 0, 0, 0.05)"
                        >{{
                          formatResult(
                            results[`${module.name}-${endpoint.method}-${endpoint.path}`]?.data,
                          )
                        }}</pre
                      >
                    </v-card-text>
                  </v-card>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </template>

        <v-alert v-else-if="module.error" type="error" variant="tonal" class="ma-4">
          Failed to load module specification
        </v-alert>
      </div>
    </template>

    <v-alert v-else type="warning" variant="tonal"> Failed to load API catalog </v-alert>
  </v-container>
</template>

<style scoped>
.swagger-endpoints {
  border: none;
}

.swagger-endpoint {
  margin-bottom: 4px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.swagger-endpoint-get {
  border-left: 4px solid rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.05);
}

.swagger-endpoint-post {
  border-left: 4px solid rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
}

.swagger-endpoint-put {
  border-left: 4px solid rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.05);
}

.swagger-endpoint-patch {
  border-left: 4px solid rgb(var(--v-theme-info));
  background: rgba(var(--v-theme-info), 0.05);
}

.swagger-endpoint-delete {
  border-left: 4px solid rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), 0.05);
}

.swagger-endpoint-content {
  background: white;
}

.swagger-params-table,
.swagger-responses-table {
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.swagger-params-table th,
.swagger-responses-table th {
  background: rgba(0, 0, 0, 0.05) !important;
}
</style>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Rest API',
    description: 'All the features via REST API',
    icon: '$mdiApi',
    color: '#4caf50',
    visibility: 'always',
    access: 'when-authenticated',
  },
})

interface OpenApiParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  description?: string
  schema?: {
    type?: string
    format?: string
    enum?: string[]
    [key: string]: unknown
  }
}

interface OpenApiRequestBody {
  required?: boolean
  description?: string
  schema?: Record<string, unknown>
  content?: {
    'application/json'?: {
      schema?: Record<string, unknown>
    }
  }
}

interface OpenApiResponse {
  code: number
  description?: string
  schema?: Record<string, unknown>
}

interface ApiEndpoint {
  method: string
  path: string
  summary?: string
  description?: string
  parameters?: OpenApiParameter[]
  requestBody?: OpenApiRequestBody
  responses: OpenApiResponse[]
  security: boolean
}

interface OpenApiManifest {
  openapi?: string
  info?: {
    title?: string
    version?: string
    description?: string
  }
  paths?: Record<string, Record<string, Record<string, unknown>>>
}

interface CatalogItem {
  name: string
  href: string
}

interface ApiModule {
  name: string
  href: string
  loading: boolean
  error: boolean
  manifest: OpenApiManifest | null
  endpoints: ApiEndpoint[]
}

interface ExecutionResult {
  status: number
  data: unknown
}

const http = useHttp()
const app = useAppStore()

const loading = ref(true)
const modules = ref<ApiModule[]>([])
const paramValues = ref<Record<string, string>>({})
const requestBodies = ref<Record<string, string>>({})
const results = ref<Record<string, ExecutionResult>>({})
const executingEndpoint = ref<string | null>(null)

const baseUrl = computed(() => {
  return import.meta.env.DEV ? '/api/' : import.meta.env.VITE_API_URI
})

function parseEndpoints(manifest: OpenApiManifest): ApiEndpoint[] {
  if (!manifest?.paths) return []

  const result: ApiEndpoint[] = []
  const pathsObj = manifest.paths

  for (const [path, methods] of Object.entries(pathsObj)) {
    for (const [method, details] of Object.entries(methods)) {
      if (method === 'parameters') continue

      const detailsObj = details as Record<string, unknown>

      const parameters: OpenApiParameter[] = []
      if (Array.isArray(detailsObj.parameters)) {
        for (const param of detailsObj.parameters) {
          const p = param as Record<string, unknown>
          parameters.push({
            name: p.name as string,
            in: p.in as 'path' | 'query' | 'header' | 'cookie',
            required: p.required as boolean | undefined,
            description: p.description as string | undefined,
            schema: p.schema as OpenApiParameter['schema'],
          })
        }
      }

      let requestBody: OpenApiRequestBody | undefined
      if (detailsObj.requestBody) {
        const rb = detailsObj.requestBody as Record<string, unknown>
        const content = rb.content as Record<string, Record<string, unknown>> | undefined
        const jsonContent = content?.['application/json']
        requestBody = {
          required: rb.required as boolean | undefined,
          description: rb.description as string | undefined,
          schema: jsonContent?.schema as Record<string, unknown> | undefined,
        }
      }

      const responses: OpenApiResponse[] = []
      if (detailsObj.responses && typeof detailsObj.responses === 'object') {
        for (const [code, resp] of Object.entries(detailsObj.responses)) {
          const respObj = resp as Record<string, unknown>
          const content = respObj.content as Record<string, Record<string, unknown>> | undefined
          const jsonContent = content?.['application/json']
          responses.push({
            code: parseInt(code, 10),
            description: respObj.description as string | undefined,
            schema: jsonContent?.schema as Record<string, unknown> | undefined,
          })
        }
      }

      result.push({
        method: method.toUpperCase(),
        path,
        summary: detailsObj.summary as string | undefined,
        description: detailsObj.description as string | undefined,
        parameters: parameters.length > 0 ? parameters : undefined,
        requestBody,
        responses,
        security:
          Array.isArray(detailsObj.security) && (detailsObj.security as unknown[]).length > 0,
      })
    }
  }

  return result
}

function getPathParams(endpoint: ApiEndpoint): OpenApiParameter[] {
  return endpoint.parameters?.filter((p) => p.in === 'path') || []
}

function getQueryParams(endpoint: ApiEndpoint): OpenApiParameter[] {
  return endpoint.parameters?.filter((p) => p.in === 'query') || []
}

function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'success',
    POST: 'primary',
    PUT: 'warning',
    PATCH: 'info',
    DELETE: 'error',
  }
  return colors[method] || 'grey'
}

function getResponseColor(code: number): string {
  if (code >= 200 && code < 300) return 'success'
  if (code >= 300 && code < 400) return 'info'
  if (code >= 400 && code < 500) return 'warning'
  if (code >= 500) return 'error'
  return 'grey'
}

function formatSchema(schema: Record<string, unknown>): string {
  return JSON.stringify(schema, null, 2)
}

function formatResult(data: unknown): string {
  if (typeof data === 'string') return data
  return JSON.stringify(data, null, 2)
}

function buildUrl(module: ApiModule, endpoint: ApiEndpoint): string {
  // Prepend module name to path (e.g., "app/" + "/context/" -> "app/context/")
  const modulePath = module.name.endsWith('/') ? module.name : module.name + '/'
  const endpointPath = endpoint.path.startsWith('/') ? endpoint.path.slice(1) : endpoint.path
  let url = modulePath + endpointPath

  // Replace path parameters
  const pathParams = endpoint.parameters?.filter((p) => p.in === 'path') || []
  for (const param of pathParams) {
    const value =
      paramValues.value[`${module.name}-${endpoint.method}-${endpoint.path}-${param.name}`] || ''
    url = url.replace(`{${param.name}}`, encodeURIComponent(value))
  }

  // Add query parameters
  const queryParams = endpoint.parameters?.filter((p) => p.in === 'query') || []
  const queryParts: string[] = []
  for (const param of queryParams) {
    const value =
      paramValues.value[`${module.name}-${endpoint.method}-${endpoint.path}-${param.name}`]
    if (value) {
      queryParts.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`)
    }
  }

  if (queryParts.length > 0) {
    url += (url.includes('?') ? '&' : '?') + queryParts.join('&')
  }

  return url
}

async function executeRequest(module: ApiModule, endpoint: ApiEndpoint) {
  const key = `${module.name}-${endpoint.method}-${endpoint.path}`
  executingEndpoint.value = key

  try {
    const url = buildUrl(module, endpoint)
    let body: unknown = undefined

    if (endpoint.requestBody && requestBodies.value[key]) {
      try {
        body = JSON.parse(requestBodies.value[key])
      } catch {
        app.ui.setError('Invalid JSON in request body')
        executingEndpoint.value = null
        return
      }
    }

    let response: { data: unknown; status: number | null }

    switch (endpoint.method) {
      case 'GET':
        response = await http.get(url)
        break
      case 'POST':
        response = await http.post(url, body)
        break
      case 'PUT':
        response = await http.put(url, body)
        break
      case 'PATCH':
        response = await http.patch(url, body)
        break
      case 'DELETE':
        response = await http.delete(url)
        break
      default:
        response = await http.get(url)
    }

    results.value[key] = {
      status: response.status || 200,
      data: response.data,
    }
  } catch (err) {
    results.value[key] = {
      status: 500,
      data: err instanceof Error ? err.message : 'Unknown error',
    }
  } finally {
    executingEndpoint.value = null
  }
}

function clearResult(module: ApiModule, endpoint: ApiEndpoint) {
  const key = `${module.name}-${endpoint.method}-${endpoint.path}`
  delete results.value[key]
}

async function loadModuleManifest(module: ApiModule) {
  module.loading = true
  try {
    const { data } = await http.get<OpenApiManifest>(`open-api-catalog/${module.name}/`)
    module.manifest = data
    module.endpoints = parseEndpoints(data as OpenApiManifest)
    module.error = false
  } catch (err) {
    module.error = true
    console.error(`Failed to load manifest for ${module.name}:`, err)
  } finally {
    module.loading = false
  }
}

async function loadCatalog() {
  loading.value = true
  try {
    const { data } = await http.get<{ items: CatalogItem[] }>('open-api-catalog/')

    if (data?.items && Array.isArray(data.items)) {
      modules.value = data.items.map((item) => ({
        name: item.name,
        href: item.href,
        loading: false,
        error: false,
        manifest: null,
        endpoints: [],
      }))

      // Load all module manifests in parallel
      await Promise.all(modules.value.map((module) => loadModuleManifest(module)))
    }
  } catch (err) {
    app.ui.setError('Failed to load API catalog')
    console.error('Failed to load API catalog:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCatalog()
})
</script>
