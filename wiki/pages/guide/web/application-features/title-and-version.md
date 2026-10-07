# Title and Version

Keep `logo.svg` and `favicon.ico` in `apps/web/public`, and the initial HTML title
in `apps/web/index.html`.

Set application metadata in `apps/web/odbvue.config.ts`:

```ts
import { defineAppConfig } from './src/app/config'

export default defineAppConfig({
  title: 'OdbVue',
  version: '1.0.0',
})
```

The default layout reads metadata directly with `useAppConfig()`:

```vue
<script setup lang="ts">
import { useAppConfig } from '@/app/config'
const config = useAppConfig()
</script>

<template>
  <v-toolbar-title>{{ config.title }}</v-toolbar-title>
  <span class="text-caption">v{{ config.version }}</span>
</template>
```

Application plugins already install Unhead. `installAppRouting()` in
`src/app/router` maintains one head entry, updating it after successful navigation.
Pages with a title produce `Application title - Page title`; pages without one use
the application title alone. Denied or cancelled navigation does not update it.

No metadata Pinia store, root-package import, or additional head plugin is needed.
