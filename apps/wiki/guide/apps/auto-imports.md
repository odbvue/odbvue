# Auto Import

## Overview

Auto import in Vue refers to a feature that automatically imports components, plugins, modules or other resources into your Vue application without the need for manually specifying each import statement at the top of your files. This can greatly simplify codebase and reduce boilerplate, especially in large projects with many components.

There are side effects of using this technique. Some impact on build server start and reload time, as plugin scans all files. And dependencies are not clearly visible. Nevertheless, the positive impact on development speed is significant.

## Routes

Check [File Based Routing](./file-based-routing.md).

## Composables

1. Install unplugin libraries

```bash
pnpm i -D unplugin-auto-import
```

2. Add auto import configuration to `vite.config.ts`

```ts
// ...
import AutoImport from 'unplugin-auto-import/vite'
// ...
plugins: [
  // ...
  AutoImport({
    imports: [
      'vue',
      'vue-router',
      'vue-i18n',
      {
        from: 'vuetify',
        imports: [
          'useDisplay',
          'useDate',
          'useDefaults',
          'useDisplay',
          'useGoTo',
          'useLayout',
          'useLocale',
          'useRtl',
          'useTheme',
        ],
      },
    ],
    dirs: ['./src/composables/**', './src/stores/**', './src/components/**'],
  }),
]
//...
```

This will create file `auto-imports.d.ts` containing auto imports for:

- vue, vue-router and i18n
- all composables for vuetify
- all composables from `@/composables` folder.

3. Add this file to `tsconfig.app,json`

```json
...
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "cypress", "./cypress.d.ts", "./auto-imports.d.ts"],
...
```

4. Modify `@/pages/sandbox/index.vue` - remove all imports, it will still work.

> [!NOTE]
> VsCode and dev restart might be needed for these changes to start working.

```vue
<template>
  <v-card :style="cardBackground">
    <v-card-title><v-icon icon="$mdiHome" />{{ t('sandbox.title') }}</v-card-title>
    <v-card-text>{{ t('sandbox.description') }}</v-card-text>
    <v-card-actions>
      <v-btn @click="console.log('Primary!')" color="primary">Primary</v-btn>
      <v-btn @click="console.log('Secondary!')" color="secondary">Secondary</v-btn>
      <v-btn @click="settings.toggleTheme()">Toggle theme</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useCardBackground } from '@/composables/ui' // [!code --]
import { useI18n } from 'vue-i18n' // [!code --]
import { useSettingsStore } from '@/stores/app/settings' // [!code --]

const cardBackground = useCardBackground('#0000ff')
const { t } = useI18n()
const settings = useSettingsStore()
</script>
```

## Components

1. Install [unplugin-vue-components](https://github.com/unplugin/unplugin-vue-components)

```bash
pnpm i unplugin-vue-components -D
```

2. Add component auto import in `./vite.config.ts`

```ts{2,7}
// ...
import Components from 'unplugin-vue-components/vite'
// ...
export default defineConfig({
  plugins: [
// ...
    Components({})
// ...
  ],
})
```

3. Test

Create `@/components/TestComponent.vue`

```vue
<template>I am a test component.</template>
```

And use it anywhere, e.g. in `@/App.vue` without any importing.

```vue
<template>
  <!-- -->
   <test-component />
  <!-- -->
</template>
```

## Icons

As on moment there is no native support yet - see [Feature request](https://github.com/vuetifyjs/vuetify-loader/issues/86), here is a custom plugin to generate icon includes based on `$mdi` pattern.

1. Create a plugin file

#### `@/plugins/icons.ts`

::: details source
<<< ../../../src/plugins/icons.ts
:::

2. Add plugin to `./vite.config.ts`

```ts{2,7}
// ...
import { AutoImportMdiIcons } from './src/plugins/icons'
// ...
export default defineConfig({
  plugins: [
// ...
    AutoImportMdiIcons({})
// ...
  ],
// ...
})
```

3. Add new icon to `@/pages/sandbox/index.vue` and check that it is auto imported.

```vue
<!-- ... -->
<v-card-title><v-icon icon="$mdiHome" /><v-icon icon="$mdiHeart" />{{ t('sandbox.title') }}</v-card-title>
<!-- ... -->
```
