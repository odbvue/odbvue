# Auto Import

## Overview

Auto import in Vue refers to a feature that automatically imports components, plugins, modules or other resources into your Vue application without the need for manually specifying each import statement at the top of your files. This can greatly simplify codebase and reduce boilerplate, especially in large projects with many components.

There are side effects of using this technique. Some impact on build server start and reload time, as plugin scans all files. And dependencies are not clearly visible. Nevertheless, the positive impact on development speed is significant.

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
    dirs: ['./src/composables/**', './src/stores/**'],
  }),
]
//...
```

This will create file `auto-imports.d.ts` containing auto imports for:

- vue, vue-router and i18n
- all composables for vuetify
- all composables from `@/composables` folder.

3. Add this file to `tsconfig.json`

```json{12}
{
  "extends": "../../tsconfig.json",
  "include": [
    "env.d.ts",
    "src/**/*",
    "src/**/*.vue",
    "e2e/**/*.ts",
    "vite.config.*",
    "vitest.config.*",
    "playwright.config.*",
    "eslint.config.*",
    "auto-imports.d.ts",
  ],
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": ["node", "jsdom"],
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

```

4. Modify `@/pages/sandbox/index.vue` - remove all imports, it will still work.

> [!NOTE]
> VsCode and dev restart might be needed for these changes to start working.

```vue
<template>
  <v-card prepend-icon="$mdiHome" :title="t('sandbox.title')">
    <v-card-text>{{ t('sandbox.description') }}</v-card-text>
    <v-card-actions>
      <v-btn @click="app.settings.toggleTheme()">Toggle theme</v-btn>
      <v-btn @click="locale = 'en'">en</v-btn>
      <v-btn @click="locale = 'fr'">fr</v-btn>
    </v-card-actions>
  </v-card>
  <test-component />
</template>

<script setup lang="ts">
const app = useAppStore()
const { locale, t } = useI18n()
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

3. Add this file to `tsconfig.json`

```json{13}
{
  "extends": "../../tsconfig.json",
  "include": [
    "env.d.ts",
    "src/**/*",
    "src/**/*.vue",
    "e2e/**/*.ts",
    "vite.config.*",
    "vitest.config.*",
    "playwright.config.*",
    "eslint.config.*",
    "auto-imports.d.ts",
    "components.d.ts"
  ],
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": ["node", "jsdom"],
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

4. Test

Create `@/components/TestComponent.vue`

```vue
<template>I am a test component.</template>
```

And use it anywhere, e.g. in `apps\web\src\pages\sandbox\index.vue` without any importing.

```vue
<template>
  <!-- -->
  <test-component />
  <!-- -->
</template>
```
