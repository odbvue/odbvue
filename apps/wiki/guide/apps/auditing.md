# Auditing

## Overview

Application need to provide such capabilities as:

- record events
- intercept and record errors
- track page and api load time

Audit data needs to be collected and sent to api in bulk.

## API

For auditing purposes add `post_audit` method.

#### `./db/src/database/odbvue/package_specs/pck_app.sql`

```plsql
--
    PROCEDURE post_audit( -- Procedure to log audit events
        p_data IN CLOB -- Audit data [{severity, message, attributes, created}]
    );
--
```

#### `./db/src/database/odbvue/package_bodies/pck_app.sql`

```plsql
--
    PROCEDURE post_audit( 
        p_data IN CLOB 
    ) AS
    BEGIN
        pck_api_audit.bulk(p_data);
    END post_audit;
--
```

## Store

Store will provide methods `inf`, `wrn`, `err` as well as handling of auto save of audit records.

#### `@/stores/app/audit.ts`

::: details source
<<< ../../../src/stores/app/audit.ts
:::

Append the new audit store to Main Store

#### `@/store/index.ts`

```ts
// ...
import { useAuditStore } from './app/audit'
// ...
export const useAppStore = defineStore('app', () => {
    const getAudit = () => useAuditStore()
// ...
  return {
      audit: getAudit(),
// ...
  }
})
```

## Error interceptor

Create error handler for interception of errors.

#### `@/plugins/errors.ts`

::: details source
<<< ../../../src/plugins/errors.ts
:::

Enable error handler

#### `@/main.ts`

```ts{2,5}
// ...
import { errorHandler } from './plugins/errors'

const app = createApp(App)
app.config.errorHandler = errorHandler
// ...
```

Add auto save of audit logs

#### `@/App.vue`

```ts
//..
onMounted(async () => {
  const app = useAppStore()
  await app.init()
  app.audit.startAutoSave()
})

onUnmounted(() => {
  const app = useAppStore()
  app.audit.stopAutoSave()
})
//..
```

From now on any Vue error will be passed to common audit store and preserved and sent to backend.

## Usage

Add audit test card to `@/pages/sandbox/index.ts`

```vue
<template>
  <!-- // .. -->
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

// ..
function error() {
  throw new Error('This is an error')
}
</script>
```
