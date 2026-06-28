# Consuming Web Services

This app consumes HTTP services through a small `ofetch` wrapper in `apps/web/src/composables/http.ts` and configures it globally from `apps/web/src/plugins/http.ts` during app startup in `apps/web/src/main.ts`.

The goal of this approach is to keep page code small while still having one place for shared concerns such as:

- base URL selection
- retry policy
- optional `Authorization` header injection
- optional token refresh and request retry on `401`
- slow request logging

## Why this approach

### Why `ofetch`

[`ofetch`](https://github.com/unjs/ofetch) is a lightweight wrapper around the Fetch API with a cleaner API for JSON work. It fits this project well because it:

- works in browser-first Vue applications
- keeps the request API close to native `fetch`
- supports typed responses well in TypeScript
- supports defaults through `$fetch.create(...)`
- supports retry behavior without introducing a larger data client

### Why use a composable plus plugin

The composable defines the reusable HTTP client API. The plugin provides application-wide configuration once at startup.

This separation matters because the HTTP layer should not depend directly on page components. Instead, runtime values and callbacks are injected through configuration.

### Access token and refresh token

- An **access token** is usually a short-lived token sent on each protected request in the `Authorization: Bearer ...` header.
- A **refresh token** is usually longer-lived and is used only to get a new access token when the current one expires.
- When the server replies with `401 Unauthorized`, the app can try to refresh the access token and then retry the original request.

In this app, the HTTP composable supports that pattern through two configuration hooks:

- `getAccessToken()` returns the current access token
- `refreshAccessToken()` refreshes it when needed

## Overview

The current flow is:

1. Configure the main API URL with environment variables.
2. Add a local Vite proxy for development.
3. Create a reusable HTTP composable in `apps/web/src/composables/http.ts`.
4. Create a plugin in `apps/web/src/plugins/http.ts` to supply global configuration.
5. Register the plugin in `apps/web/src/main.ts`.
6. Use `useHttp()` inside pages and components such as `apps/web/src/pages/sandbox/sandbox-http.vue`.

If there is no dedicated backend yet, step 1 and step 2 can stay in place while pages consume external public APIs directly.

## Install `ofetch`

Install [ofetch](https://github.com/unjs/ofetch) in the web app.

```bash
pnpm add ofetch
```

## Create the HTTP composable

Create `apps/web/src/composables/http.ts`.

This file is responsible for:

- creating the shared `$fetch` client
- exposing `get`, `post`, `put`, `delete`, and `patch`
- mapping thrown errors to a consistent `{ data, error, status }` shape
- adding `Authorization` headers when configured
- retrying transient server failures
- handling `401` refresh and retry logic when configured

Key ideas in the implementation:

1. `baseURL` points to `/api/` in development and `VITE_API_URI` otherwise.
2. `configureHttp(...)` stores runtime callbacks and options.
3. `getAuthHeaders()` reads optional authorization data from injected configuration.
4. `executeRequest(...)` centralizes request execution and error handling.
5. A refresh queue prevents multiple simultaneous refresh requests.

You can use this composable without configuring any of the optional hooks.

#### `@/composables/http.ts`

::: details source

```ts
import { $fetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'

const baseURL = import.meta.env.DEV ? '/api/' : import.meta.env.VITE_API_URI

let isRefreshing = false
const requestQueue: Array<{
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  request: string
  options?: FetchOptions<'json'>
}> = []

interface HttpResponse<T = unknown> {
  data: T | null
  error: Error | null
  status: number | null
}

interface HttpClient {
  <T>(request: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  get<T>(url: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  post<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  put<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  delete<T>(url: string, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
  patch<T>(url: string, body?: unknown, options?: FetchOptions<'json'>): Promise<HttpResponse<T>>
}

export interface HttpSlowRequestContext {
  request: string
  duration: number
  options?: FetchOptions<'json'>
}

export interface HttpRefreshFailureContext {
  request: string
  error?: unknown
  options?: FetchOptions<'json'>
}

export interface HttpConfiguration {
  getAccessToken?: () => string | null | undefined
  slowRequestThresholdMs?: number
  onSlowRequest?: (context: HttpSlowRequestContext) => void
  refreshAccessToken?: () => Promise<boolean>
  shouldRefresh?: (request: string, options?: FetchOptions<'json'>) => boolean
  onRefreshFailure?: (context: HttpRefreshFailureContext) => void
}

const httpConfiguration: HttpConfiguration = {
  shouldRefresh: (request) => !request.includes('refresh/') && !request.includes('login/'),
}

export function configureHttp(configuration: HttpConfiguration): void {
  Object.assign(httpConfiguration, configuration)
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const accessToken = httpConfiguration.getAccessToken?.()

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return headers
}

function getErrorStatus(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null
  }

  const errorWithStatus = error as Error & {
    status?: unknown
    statusCode?: unknown
  }

  if (typeof errorWithStatus.statusCode === 'number') {
    return errorWithStatus.statusCode
  }

  if (typeof errorWithStatus.status === 'number') {
    return errorWithStatus.status
  }

  return null
}

async function flushQueuedRequests(client: ReturnType<typeof $fetch.create>): Promise<void> {
  while (requestQueue.length > 0) {
    const queuedRequest = requestQueue.shift()
    if (!queuedRequest) {
      continue
    }

    try {
      const result = await executeRequest(client, queuedRequest.request, queuedRequest.options)
      queuedRequest.resolve(result)
    } catch (queueError) {
      queuedRequest.reject(queueError)
    }
  }
}

function rejectQueuedRequests(error: Error): void {
  while (requestQueue.length > 0) {
    const queuedRequest = requestQueue.shift()
    if (queuedRequest) {
      queuedRequest.reject(error)
    }
  }
}

async function executeRequest<T>(
  client: ReturnType<typeof $fetch.create>,
  request: string,
  options?: FetchOptions<'json'>,
): Promise<HttpResponse<T>> {
  let data: T | null = null
  let error: Error | null = null
  let status: number | null = null

  try {
    const authHeaders = getAuthHeaders()
    const startTime = performance.now()
    const response = await client<T>(request, {
      ...options,
      headers: {
        ...authHeaders,
        ...(options?.headers as Record<string, string>),
        'request-startTime': startTime.toString(),
      },
    })

    const duration = performance.now() - startTime
    const threshold = httpConfiguration.slowRequestThresholdMs
    if (typeof threshold === 'number' && duration >= threshold) {
      httpConfiguration.onSlowRequest?.({
        request,
        duration,
        options,
      })
    }

    data = response
    error = null
    status = 200
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err))
    data = null
    status = getErrorStatus(err)

    const shouldRefresh =
      status === 401 &&
      !!httpConfiguration.refreshAccessToken &&
      (httpConfiguration.shouldRefresh?.(request, options) ?? true)

    if (shouldRefresh) {
      const sessionExpiredError = new Error('session.expired')

      if (!isRefreshing) {
        isRefreshing = true

        try {
          const refreshed = await httpConfiguration.refreshAccessToken?.()
          isRefreshing = false

          if (refreshed) {
            const retryResult = await executeRequest<T>(client, request, options)
            await flushQueuedRequests(client)
            return retryResult
          } else {
            rejectQueuedRequests(sessionExpiredError)
            httpConfiguration.onRefreshFailure?.({ request, error: sessionExpiredError, options })
          }
        } catch (refreshError) {
          isRefreshing = false
          rejectQueuedRequests(sessionExpiredError)
          httpConfiguration.onRefreshFailure?.({ request, error: refreshError, options })
        }
      } else {
        return new Promise((resolve, reject) => {
          requestQueue.push({
            resolve: resolve as (value: unknown) => void,
            reject,
            request,
            options,
          })
        })
      }
    }
  }

  return {
    data,
    error,
    status,
  }
}

export function useHttp(): HttpClient {
  let retryCount = 0

  const client = $fetch.create({
    baseURL,
    retry: 3,
    retryStatusCodes: [500, 502, 503, 504],
    retryDelay: () => {
      retryCount++
      const base = 300 * Math.pow(2, retryCount - 1)
      const jitter = Math.random() * 150
      return base + jitter
    },
  })

  const http = async <T>(
    request: string,
    options?: FetchOptions<'json'>,
  ): Promise<HttpResponse<T>> => executeRequest<T>(client, request, options)

  http.get = async <T>(url: string, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, { ...options, method: 'GET' })

  http.post = async <T>(url: string, body?: unknown, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, {
      ...options,
      method: 'POST',
      body: body as Record<string, unknown>,
    })

  http.put = async <T>(url: string, body?: unknown, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, {
      ...options,
      method: 'PUT',
      body: body as Record<string, unknown>,
    })

  http.delete = async <T>(url: string, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, { ...options, method: 'DELETE' })

  http.patch = async <T>(url: string, body?: unknown, options?: FetchOptions<'json'>) =>
    executeRequest<T>(client, url, {
      ...options,
      method: 'PATCH',
      body: body as Record<string, unknown>,
    })

  return http as HttpClient
}
```

:::

## Create the HTTP plugin

Create `apps/web/src/plugins/http.ts`.

The plugin is the global setup point for HTTP behavior. It applies shared configuration once when the Vue app starts.

At the moment it:

- sets the default slow request threshold to `3000ms`
- logs slow requests to the console
- allows callers to inject optional callbacks such as `getAccessToken`, `refreshAccessToken`, and `onRefreshFailure`

#### `@/plugins/http.ts`

::: details source

```ts
import type { Plugin } from 'vue'

import { configureHttp, type HttpConfiguration } from '../composables/http'

export interface HttpPluginOptions extends HttpConfiguration {}

const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 3000

export function createHttpPlugin(options: HttpPluginOptions = {}): Plugin {
  const {
    onSlowRequest,
    slowRequestThresholdMs = DEFAULT_SLOW_REQUEST_THRESHOLD_MS,
    ...configuration
  } = options

  return {
    install() {
      configureHttp({
        ...configuration,
        slowRequestThresholdMs,
        onSlowRequest:
          onSlowRequest ??
          (({ request, duration }) => {
            console.warn(`Slow API call: ${request} (${Math.round(duration)}ms)`)
          }),
      })
    },
  }
}
```

:::

## Register the plugin in the app

Install the HTTP plugin in `apps/web/src/main.ts` after Pinia is registered and before pages start making requests.

#### `@/main.ts`

::: details source

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import i18n from './plugins/i18n'
import { createHttpPlugin } from './plugins/http'
import piniaPersist from './plugins/pinia-persist'
import { createHead } from '@unhead/vue/client'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPersist)
app.use(pinia)
app.use(createHttpPlugin())

app.use(router)
app.use(vuetify)
app.use(i18n)
app.use(createHead())

app.mount('#app')
```

:::

## Optional callbacks

The plugin accepts optional callbacks through `createHttpPlugin(...)`.

These callbacks are useful when a project wants to:

1. attach an authorization header
2. react to slow requests
3. retry a request after a `401`
4. react when refresh fails

If you do not need any of that behavior yet, `createHttpPlugin()` works fine with no options.

## Consume a service in a page

The sandbox page shows the simplest usage pattern in `apps/web/src/pages/sandbox/sandbox-http.vue`.

It keeps request state local to the component:

- `joke` stores the response payload for display
- `loading` controls the overlay
- `useHttp()` provides the request client

This example uses a public external API, so no auth configuration is needed.

#### `@/pages/sandbox/sandbox-http.vue`

::: details source

```vue
<template>
  <v-container>
    <v-row>
      <v-col cols="12"><h3>HTTP Request Testing</h3></v-col>
      <v-col cols="12" md="6">
        <v-card :prepend-icon="'$mdiAccountCowboyHat'" title="Chuck Norris Jokes API" :text="joke">
          <v-card-actions>
            <v-btn color="primary" @click="getJoke">Get New Joke</v-btn>
          </v-card-actions>
          <v-overlay v-model="loading" persistent contained />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
const http = useHttp()

const joke = ref('')
const loading = ref(false)

const getJoke = async () => {
  loading.value = true
  const { data, error } = await http.get<{ value: string }>(
    'https://api.chucknorris.io/jokes/random',
  )
  loading.value = false

  if (error) {
    console.error('Error fetching joke:', error)
  } else if (data) {
    joke.value = data.value
  }
}

onMounted(() => {
  getJoke()
})
</script>
```

:::

## Step-by-step recipe for a new service call

Use this sequence when adding another web service call.

1. Confirm the endpoint works.

```text
GET https://api.example.com/health
```

2. Decide whether the call needs any custom headers or retry-related callbacks.

3. Create a response type near the page, component, or store using the endpoint.

```ts
type ContextResponse = {
  ok: boolean
}
```

4. Create the client in the consumer.

```ts
const http = useHttp()
```

5. Add local request state if the UI needs it.

```ts
const loading = ref(false)
const errorMessage = ref('')
```

6. Execute the request.

```ts
loading.value = true
const { data, error, status } = await http.get<ContextResponse>('health')
loading.value = false
```

7. Handle success and failure explicitly.

```ts
if (error) {
  errorMessage.value = `Request failed with status ${status}`
} else if (data) {
  console.log(data.ok)
}
```

## Examples

Simple `GET`:

```ts
const http = useHttp()
const { data, error, status } = await http.get<{ value: string }>(
  'https://api.chucknorris.io/jokes/random',
)
```

Simple `POST`:

```ts
const http = useHttp()
const { data, error, status } = await http.post('comments', { text: 'Hello' })
```

Custom headers:

```ts
const http = useHttp()
const { data, error } = await http.get('health', {
  headers: {
    'X-Correlation-Id': crypto.randomUUID(),
  },
})
```

## Notes

- `loading` is intentionally left as a component concern. The current HTTP composable returns the final request result, not a reactive request state object.
- Requests automatically receive the `Authorization` header when `getAccessToken()` is configured.
- `401` handling is centralized in the composable when `refreshAccessToken()` is configured.
- Slow requests are currently logged to the console by the plugin.
- Retrying `500`, `502`, `503`, and `504` is built into the client configuration.

Further on, calling a web service remains lightweight:

```ts
const http = useHttp()

const { data, error, status } = await http('health')

const { data, error, status } = await http.post('comments', { key: 'value' })
```
