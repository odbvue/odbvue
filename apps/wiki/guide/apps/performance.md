# Performance

App will log all events exceeding pre-defined performance threshold (default - 250ms)

## API

Add configuration parameters to `get_context` 

```sql
MERGE INTO app_settings d
USING (SELECT 
    'APP_PERFORMANCE_THRESHOLD_MS' AS id, 
    'App performance threshold in milliseconds' AS name, 
    '250' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);
```

#### `./db/src/database/odbvue/package_specs/pck_app.sql`

```plsql{5}
    PROCEDURE get_context ( -- Returns application context
        r_version OUT VARCHAR2, -- Application version
        r_user OUT SYS_REFCURSOR, -- User data [{uuid, username, fullname, created}]
        r_consents OUT SYS_REFCURSOR, -- Consents [{id, language, name, created}]
        r_config OUT SYS_REFCURSOR -- Configuration [{key, value}]
    );
```

#### `./db/src/database/odbvue/package_bodies/pck_app.sql`

```plsql
        OPEN r_config FOR
        SELECT 
            id AS "key", 
            value AS "value" 
        FROM app_settings WHERE id IN (
            'APP_PERFORMANCE_THERESHOLD_MS'
        );
```

## Stores

```ts
    type ContextResponse = {
      // ..
      config: {
        key: string
        value: string
      }[]
    }
    //..
    const config = ref<ContextResponse['config']>([])

    const appPerformanceThresholdMs = computed(() => {
      const setting = config.value.find((c) => c.key === 'APP_PERFORMANCE_THRESHOLD_MS')
      return setting ? parseInt(setting.value, 10) : 250
    })
    // ..
    async function init() {
      // ..
      config.value = data?.config ?? []
    }
    // ..
    return {
      // ..
      config,
      appPerformanceThresholdMs,
      // ..
    }
```

## Page load

Add logic in Router to track this information

#### `@/router/index.ts`

```ts{3,7-13}
// ...
router.beforeEach(async (to) => {
  to.meta.performance = performance.now()
// ...
})

router.afterEach((to) => {
  // ..  
  const duration: number = performance.now() - (to.meta.performance as number)
  if (duration >= useAppStore().appPerformanceThresholdMs) {
    const appAudit = useAuditStore()
    appAudit.wrn('Slow Page Load', `Route ${to.path} took ${duration}ms`)
  }
})
// ...
```

## API calls

Add logic in HTTP interceptors to detect slow API calls in `

#### `@\composables\http.ts`

```ts{3,9,14-19}
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

    // Check performance threshold
    const duration = performance.now() - startTime
    const appStore = useAppStore()
    if (duration >= appStore.appPerformanceThresholdMs) {
      const appAudit = useAuditStore()
      appAudit.wrn('Slow API call', `API ${request} took ${duration}ms`)
    }
    data = response
    // ..
```    