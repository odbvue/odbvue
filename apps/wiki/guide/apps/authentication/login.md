# Authentication

## Overview

The application implements OAuth-style token-based authentication:

- **Login**: User submits credentials → Backend returns `access_token` and `refresh_token` → Access token stored in memory, refresh token stored in secure HTTP-only cookie
- **Authenticated Requests**: Access token sent in Authorization header; if it expires, HTTP middleware intercepts 401 responses and attempts refresh
- **Token Refresh**: Middleware uses stored refresh token to obtain new access token without user re-login; if refresh fails, user is logged out
- **Logout**: Access token cleared, refresh token deleted from cookies, user session terminated

## API

Settings needed for authentication

::: details source
```sql
MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_SAFE_ATTEMPTS' AS id, 'App authentication safe attempts' AS name, '5' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_BASE_DELAY' AS id, 'App authentication base delay in seconds' AS name, '5' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_MAX_DELAY' AS id, 'App authentication max delay in seconds' AS name, '3600' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_JWT_ISSUER' AS id, 'App authentication JWT issuer' AS name, 'OdbVue' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_JWT_AUDIENCE' AS id, 'App authentication JWT audience' AS name, 'OdbVue Audience' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_JWT_SECRET' AS id, 'App authentication JWT secret' AS name, DBMS_RANDOM.STRING('A', 200) AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

```
:::

Methods for login with username and password, logout and obtaining refresh token.

#### `./db/src/database/odbvue/package_specs/pck_app.sql`

::: details specification
```plsql
CREATE OR REPLACE PACKAGE odbvue.pck_app AS -- Package for the main application     
    PROCEDURE get_context ( -- Returns application context
        r_version OUT VARCHAR2, -- Application version
        r_user    OUT SYS_REFCURSOR -- User data
    );

    PROCEDURE post_login ( -- Procedure authenticates user and returns tokens (PUBLIC)
        p_username      app_users.username%TYPE, -- User name (e-mail address)
        p_password      app_users.password%TYPE, -- Password
        r_access_token  OUT app_tokens.token%TYPE, -- Token
        r_refresh_token OUT app_tokens.token%TYPE -- Refresh token
    );

    PROCEDURE post_logout; -- Procedure invalidates access and refresh tokens

    PROCEDURE post_refresh ( -- Procedure re-issues access and refresh tokens
        r_access_token  OUT app_tokens.token%TYPE, -- Token
        r_refresh_token OUT app_tokens.token%TYPE -- Refresh token
    );

    PROCEDURE post_heartbeat; -- Procedure to keep the session alive
END pck_app;
/

```
:::

#### `./db/src/database/odbvue/package_bodies/pck_app.sql`

::: details implementation
```plsql
CREATE OR REPLACE PACKAGE BODY odbvue.pck_app AS

    g_version VARCHAR2(30 CHAR) := '...';

    PROCEDURE get_context (
        r_version OUT VARCHAR2,
        r_user    OUT SYS_REFCURSOR
    ) IS
        v_uuid app_users.uuid%TYPE := pck_api_auth.uuid;
    BEGIN
        r_version := g_version;
        IF v_uuid IS NULL THEN
            RETURN;
        END IF;
        OPEN r_user FOR SELECT
                                            uuid     AS "uuid",
                                            username AS "username",
                                            fullname AS "fullname",
                                            created  AS "created"
                                        FROM
                                            app_users
                        WHERE
                                uuid = v_uuid
                            AND v_uuid IS NOT NULL;

    END get_context;

    PROCEDURE post_login (
        p_username      app_users.username%TYPE,
        p_password      app_users.password%TYPE,
        r_access_token  OUT app_tokens.token%TYPE,
        r_refresh_token OUT app_tokens.token%TYPE
    ) AS
        v_uuid        app_users.uuid%TYPE;
        v_status      PLS_INTEGER;
        v_audit_attrs app_audit.attributes%TYPE;
    BEGIN
        pck_api_auth.auth(p_username, p_password, v_uuid, v_status);
        v_audit_attrs := pck_api_audit.attributes('username', p_username, 'password', '********', 'uuid',
                                                  v_uuid, 'status', v_status);

        IF ( v_status = 200 ) THEN
            r_access_token := pck_api_auth.issue_token(v_uuid, 'ACCESS');
            pck_api_auth.revoke_token(v_uuid, 'REFRESH');
            r_refresh_token := pck_api_auth.issue_token(v_uuid, 'REFRESH');
            pck_api_audit.info('Login success', v_audit_attrs);
        ELSE
            pck_api_audit.warn('Login error', v_audit_attrs);
        END IF;

        pck_api_auth.http(v_status);
    EXCEPTION
        WHEN OTHERS THEN
            r_access_token := NULL;
            r_refresh_token := NULL;
            pck_api_audit.error('Login error', v_audit_attrs);
            pck_api_auth.http(401);
    END;

    PROCEDURE post_logout AS

        v_uuid        app_users.uuid%TYPE := coalesce(pck_api_auth.uuid,
                                               pck_api_auth.refresh('refresh_token'));
        v_audit_attrs app_audit.attributes%TYPE := pck_api_audit.attributes('uuid', v_uuid);
    BEGIN
        pck_api_auth.revoke_token(v_uuid, 'ACCESS');
        pck_api_auth.revoke_token(v_uuid, 'REFRESH');
        IF v_uuid IS NOT NULL THEN
            pck_api_audit.info('Logout success', v_audit_attrs);
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            pck_api_audit.error('Logout error', v_audit_attrs);
    END;

    PROCEDURE post_refresh (
        r_access_token  OUT app_tokens.token%TYPE,
        r_refresh_token OUT app_tokens.token%TYPE
    ) AS

        v_uuid        app_users.uuid%TYPE := pck_api_auth.refresh('refresh_token');
        v_audit_attrs app_audit.attributes%TYPE := pck_api_audit.attributes('uuid', v_uuid);
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
        ELSE
            r_access_token := pck_api_auth.issue_token(v_uuid, 'ACCESS');
            r_refresh_token := pck_api_auth.issue_token(v_uuid, 'REFRESH');
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            r_access_token := NULL;
            r_refresh_token := NULL;
            pck_api_audit.error('Refresh error', v_audit_attrs);
            pck_api_auth.http_401;
    END;

    PROCEDURE post_heartbeat AS
    BEGIN
        IF pck_api_auth.uuid IS NULL THEN
            pck_api_auth.http_401;
        END IF;
    END post_heartbeat;

BEGIN
    SELECT
        replace(
            lower(regexp_replace(
                sys_context('USERENV', 'CURRENT_EDITION_NAME'),
                '^[A-Z0-9#$_]+_V_',
                'v'
            )),
            '_',
            '.'
        )
    INTO g_version
    FROM
        dual;

END pck_app;
/
```
:::

## Dependencies

Install package for handling cookies

```bash
pnpm i js-cookie
pnpm i @types/js-cookie

```

## Stores

### Authentication store

#### `@/stores/app/auth.ts`

::: details source
```ts
import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref } from 'vue'
import Cookies from 'js-cookie'
import { useAppStore } from '../index'
import { useUiStore } from './ui'
import { useHttp } from '@/composables/http'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const { startLoading, stopLoading, setError, clearMessages, setInfo } = useUiStore()

    const api = useHttp()

    type AuthResponse = {
      access_token: string
      refresh_token: string
      error?: string
      errors?: { name: string; message: string }[]
    }

    const refreshCookieOptions = {
      path: '/',
      secure: true,
      sameSite: 'Strict' as const,
      domain: window.location.hostname,
      expires: 7,
    }

    const accessToken = ref('')
    const isAuthenticated = ref(false)

    const refreshToken = () => Cookies.get('refresh_token')

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
        setError(errorMessage)
      } else {
        accessToken.value = data.access_token
        Cookies.set('refresh_token', data.refresh_token, refreshCookieOptions)
        isAuthenticated.value = true
        clearMessages()
      }

      await useAppStore().init()
      stopLoading()
      return isAuthenticated.value
    }

    const logout = async () => {
      accessToken.value = ''
      Cookies.remove('refresh_token', { path: '/', domain: window.location.hostname })
      isAuthenticated.value = false
      await api.post('app/logout/')
      await useAppStore().init()
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
      login,
      logout,
      refresh,
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['isAuthenticated'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
``` 
:::

### Application Store

#### `@/stores/index.ts`

::: details source
```ts
// ...

export const useAppStore = defineStore(
  'app',
  () => {
    // ...
    const getAuth = () => useAuthStore()

    type ContextResponse = {
      version: string
      user?: {
        uuid: string
        username: string
        fullname: string
        created: string
      }[]
    }

    const defaultUser = {
      uuid: '',
      username: '',
      fullname: '',
      created: '',
    }

    // ...
    const user = ref(defaultUser)
=
    // ...

    async function init() {
      // ...
      user.value = data?.user?.[0] ?? defaultUser
    }

    return {
      // ...
      user,
      // ...
      auth: getAuth(),
    }
  },
  {
    storage: {
      adapter: 'localStorage',
      include: ['user'],
    },
  } as Record<string, unknown>,
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}

```
:::

## Handling Refresh Token

Upgrade http composable to handle refresh token logic. When an API request receives a 401 response, the HTTP middleware automatically attempts to refresh the access token using the stored refresh token. If the refresh succeeds, the original request is retried with the new token. If refresh fails (invalid/expired refresh token), the user is logged out.

#### `@/composables/http.ts`

::: details source
<<< ../../../../src/composables/http.ts
:::

## Login form

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

const app = useAppStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const devAction = import.meta.env.DEV ? ['dev'] : []

const options = ref<OvFormOptions>({
  fields: [
    {
      type: 'text',
      name: 'username',
      label: 'username',
      placeholder: 'username',
      rules: [
        { type: 'required', params: true, message: 'username.is.required' },
        { type: 'email', params: true, message: 'username.must.be.a.valid.email.address' },
      ],
    },
    {
      type: 'password',
      name: 'password',
      label: 'password',
      placeholder: 'password',
      rules: [{ type: 'required', params: true, message: 'password.is.required' }],
    },
  ],
  actions: ['submit', ...devAction],
  actionAlign: 'right',
  actionSubmit: 'submit',
})

const data = ref({
  username: '',
  password: '',
})

const submit = async (newData: typeof data.value) => {
  if (await app.auth.login(newData.username, newData.password))
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

Updated Navigation store to not include in menu etc. login and similar pages with `{ meta: { role: 'guest' } }`

```ts{5}
  const pages = computed(() => {
    return allPages
      .filter((page) => page.level < 2)
      .filter((page) => page.path !== '/:path(.*)')
      .filter((page) => page.role !== 'guest')
  })
```

Adjusted Default Layout:

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
