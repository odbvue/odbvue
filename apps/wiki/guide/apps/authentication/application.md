# Authentication in App

## Overview

The application implements OAuth-style token-based authentication:

- **Login**: User submits credentials → Backend returns `access_token` and `refresh_token` → Access token stored in memory, refresh token stored in secure HTTP-only cookie
- **Authenticated Requests**: Access token sent in Authorization header; if it expires, HTTP middleware intercepts 401 responses and attempts refresh
- **Token Refresh**: Middleware uses stored refresh token to obtain new access token without user re-login; if refresh fails, user is logged out
- **Logout**: Access token cleared, refresh token deleted from cookies, user session terminated

## Authentication logic

1.  Install package for handling cookies

```bash
pnpm i js-cookie
pnpm i @types/js-cookie

```

2. Create Authentication store

#### `@/stores/app/auth.ts`

::: details source
```ts
import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref } from 'vue'
import Cookies from 'js-cookie'
import { useUiStore } from './ui'
import { useHttp } from '@/composables/http'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const { startLoading, stopLoading, setError, clearMessages } = useUiStore()

    const api = useHttp()

    type AuthResponse = {
      access_token: string
      refresh_token: string
      error? : string
    }

    type ContextResponse = {
      version: string
      user: {
        uuid: string
        username: string
        fullname: string
        created: string
      }[]
    }

    const refreshCookieOptions = {
      path: '/',
      secure: true,
      sameSite: 'Strict' as const,
      domain: window.location.hostname,
      expires: 7,
    }

    const defaultUser = {
      uuid: '',
      username: '',
      fullname: '',
      created: '',
    }

    const accessToken = ref('')
    const isAuthenticated = ref(false)
    const user = ref({ ...defaultUser })

    function refreshToken() {
      return Cookies.get('refresh_token')
    }

    const login = async (username: string, password: string): Promise<boolean> => {
      startLoading()

      const { data, error, status } = await api.post<AuthResponse>('app/login/', {
        username,
        password,
      })

      if (error || !data) {
        const errorMessages = {
          401: 'unauthorized',
          403: 'forbidden',
          429: 'too.many.requests',
        }
        const errorMessage = errorMessages[(status as 401 | 403 | 429) ?? 401]
        isAuthenticated.value = false
        user.value = { ...defaultUser }
        setError(errorMessage)
      } else {
        accessToken.value = data.access_token
        Cookies.set('refresh_token', data.refresh_token, refreshCookieOptions)

        const { data: contextData } = await api<ContextResponse>('app/context/')
        user.value = contextData?.user[0] ?? { ...defaultUser }

        isAuthenticated.value = true
        clearMessages()
      }

      stopLoading()
      return isAuthenticated.value
    }

    const logout = () => {
      accessToken.value = ''
      Cookies.remove('refresh_token', { path: '/', domain: window.location.hostname })
      isAuthenticated.value = false
      user.value = { ...defaultUser }
      api.post('app/logout/')
      clearMessages()
    }

    const refresh = async (): Promise<boolean> => {
      const token = refreshToken()
      if (!token) {
        logout()
        return false
      }

      try {
        const { data, error, status } = await api.post<AuthResponse>('app/refresh/', null, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (error || !data) {
          const errorMessages = {
            401: 'session.expired',
            403: 'forbidden',
          }
          const errorMessage = errorMessages[(status as 401 | 403) ?? 401]
          setError(errorMessage)
          logout()
          return false
        }

        accessToken.value = data.access_token
        Cookies.set('refresh_token', data.refresh_token, refreshCookieOptions)
        isAuthenticated.value = true
        return true
      } catch {
        logout()
        return false
      }
    }

    return {
      accessToken,
      refreshToken,
      isAuthenticated,
      user,
      login,
      logout,
      refresh,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['isAuthenticated', 'user'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
``` 
:::

3. Include Authentication store in main

#### `@/stores/index.ts`

```ts
// ...
  const getAuth = () => useAuthStore()
// ...
  return { 
    // ...
    auth: getAuth(),
  }
// ...
```

## Refresh token

Upgrade http composable to handle refresh token logic. When an API request receives a 401 response, the HTTP middleware automatically attempts to refresh the access token using the stored refresh token. If the refresh succeeds, the original request is retried with the new token. If refresh fails (invalid/expired refresh token), the user is logged out.

#### `@/composables/http.ts`

::: details source
<<< ../../../../src/composables/http.ts
:::

## Login form

1. Create Login form

#### `@/pages/login.vue`

::: details source
```vue
<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" :md="4">
        <h1 class="mb-4">{{ t('login') }}</h1>
        <v-ov-form :options :data :t @submit="submit" @action="dev" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePage({ meta: { role: 'guest' } })

const appStore = useAppStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const devAction = import.meta.env.DEV ? ['dev'] : []

const options = <OvFormOptions>{
  fields: [
    {
      type: 'text',
      name: 'username',
      label: t('username'),
      placeholder: t('username'),
      rules: [
        { type: 'required', params: true, message: 'username.is.required' },
        { type: 'email', params: true, message: 'username.must.be.a.valid.email.address' },
      ],
    },
    {
      type: 'password',
      name: 'password',
      label: t('password'),
      placeholder: t('password'),
      rules: [{ type: 'required', params: true, message: 'password.is.required' }],
    },
  ],
  actions: ['submit', ...devAction],
  actionAlign: 'right',
  actionSubmit: 'submit',
}

const data = ref({
  username: '',
  password: '',
})

const submit = async (newData: typeof data.value) => {
  if (await appStore.auth.login(newData.username, newData.password))
    router.push((route.query.redirect as string) || '/')
}

const dev = async () => {
  data.value = {
    username: import.meta.env.VITE_APP_USERNAME,
    password: import.meta.env.VITE_APP_PASSWORD,
  }
}
</script>

```
:::

2. Update Navigation store to not include in menu etc. login and similar pages with `{ meta: { role: 'guest' } }`

```ts{5}
  const pages = computed(() => {
    return allPages
      .filter((page) => page.level < 2)
      .filter((page) => page.path !== '/:path(.*)')
      .filter((page) => page.role !== 'guest')
  })
```

3. Adjust Default Layout

Add to Default Layout:

- Login / Logout button in App Bar

- User name and logout in Navigation Bar

#### `@/layots/DefaultLayout.vue`

```vue
    <v-navigation-drawer>
      <v-list>
      <!-- // -->
      </v-list>
      <v-divider v-if="app.auth.isAuthenticated" />
      <v-list v-if="app.auth.isAuthenticated">
        <v-list-item>
          <strong>{{ app.user?.fullname }}</strong>
        </v-list-item>
        <v-list-item link prepend-icon="$mdiLogout" @click="app.auth.logout()">
          <v-list-item-title>{{ t('logout') }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-app-bar>
      <!-- // -->
      <v-btn v-show="!app.auth.isAuthenticated" to="/login" class="mr-2">
        <v-icon icon="$mdiAccount"></v-icon>
        {{ t('login') }}
      </v-btn>
      <v-btn v-show="app.auth.isAuthenticated" @click="app.auth.logout()" class="mr-2">
        <v-icon icon="$mdiLogout"></v-icon>
        {{ t('logout') }}
      </v-btn>
      <!-- // -->
    </v-app-bar>  
```

## Test

`POST app/heartbeat/` method can be used tp test Refresh Token behaviors.

#### `@/pages/sandbox/index.vue`

```vue
<template>
  <!-- // -->
  <v-container fluid>
    <h2 class="mb-4">API</h2>
    <v-row>
      <v-col cols="12">
        <v-btn @click="postHeartbeat()">{{ heartbeatStatus }}</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
//

const heartbeatStatus = ref('Status: N/A')
const api = useHttp()
const postHeartbeat = async () => {
  const { status } = await api.post('app/heartbeat/')
  heartbeatStatus.value = `Status: ${status}`
}
//
</script>
```
