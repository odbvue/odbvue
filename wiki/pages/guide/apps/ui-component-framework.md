# UI Component Framework

## Overview

The web app uses [Vuetify](https://vuetifyjs.com/) as its UI component framework. The current setup in `apps/web` combines:

- Vuetify 4 for components and theming
- `vite-plugin-vuetify` for Vite integration
- `@mdi/js` plus the Vuetify SVG icon set for tree-shaken icons
- a small `src/themes` folder for themes, defaults, and icon aliases

## Install the dependencies

From the workspace root:

```bash
pnpm --dir apps/web install vuetify @mdi/js
pnpm --dir apps/web install -D vite-plugin-vuetify
```

## Configure Vite

The actual `apps/web/vite.config.ts` adds `Vuetify()` to the plugin list alongside the router, Markdown, and devtools plugins:

```ts
//..
import Vuetify from 'vite-plugin-vuetify'
//..

export default defineConfig({
  plugins: [
    //..
    Vuetify(),
    //..
  ],
  //..
})
```

## Create the Vuetify plugin

Project configuration lives in `apps/web/src/plugins/vuetify.ts`:

```ts
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { md3 } from 'vuetify/blueprints'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

import { light, dark } from '../themes/themes.json'
import { defaults } from '../themes/defaults'
import icons from '../themes/icons'

export default createVuetify({
  blueprint: md3,
  theme: {
    defaultTheme: 'system',
    themes: {
      light,
      dark,
    },
  },
  defaults,
  icons: {
    defaultSet: 'mdi',
    aliases: {
      ...aliases,
      ...icons,
    },
    sets: {
      mdi,
    },
  },
})
```

This setup enables four things at once:

- the Material Design 3 blueprint
- light and dark themes loaded from JSON
- global component defaults
- custom icon aliases merged into the default MDI aliases

## Register Vuetify in the app

Register the plugin in `apps/web/src/main.ts`:

```ts{6,12}
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')
```

Add Sandbox link to the demo page `App.vue`:

```vue
<template>
  <v-container>
    <router-link to="/">Home</router-link>
    |
    <router-link to="/about">About</router-link>
    |
    <router-link to="/sandbox">Sandbox</router-link>
    <br />
    <br />
    <router-view />
  </v-container>
</template>
```

## Themes

The project keeps theme data in `apps/web/src/themes/themes.json`. It defines both `light` and `dark` palettes and related Vuetify theme variables.

::: details source

```json
{
  "light": {
    "dark": false,
    "colors": {
      "background": "#fcfcff",
      "surface": "#fcfcff",
      "primary": "#00629e",
      "secondary": "#526070",
      "success": "#41a35c",
      "warning": "#d98818",
      "error": "#ba1a1a",
      "info": "#1c8ee6",
      "on-background": "#1a1c1e",
      "on-surface": "#1a1c1e",
      "on-primary": "#ffffff",
      "on-secondary": "#ffffff",
      "on-success": "#000000",
      "on-warning": "#000000",
      "on-error": "#ffffff",
      "on-info": "#FFFFFF"
    },
    "variables": {
      "border-color": "#1a1c1e",
      "border-opacity": 0.12,
      "high-emphasis-opacity": 0.87,
      "medium-emphasis-opacity": 0.6,
      "disabled-opacity": 0.38,
      "idle-opacity": 0.04,
      "hover-opacity": 0.04,
      "focus-opacity": 0.12,
      "selected-opacity": 0.08,
      "activated-opacity": 0.12,
      "pressed-opacity": 0.12,
      "dragged-opacity": 0.08,
      "theme-kbd": "#212529",
      "theme-on-kbd": "#FFFFFF",
      "theme-code": "#F5F5F5",
      "theme-on-code": "#000000"
    }
  },
  "dark": {
    "dark": true,
    "colors": {
      "background": "#1a1c1e",
      "surface": "#1a1c1e",
      "primary": "#99cbff",
      "secondary": "#bac8da",
      "success": "#41a35c",
      "warning": "#d98818",
      "error": "#ffb4ab",
      "info": "#1c8ee6",
      "on-background": "#e2e2e5",
      "on-surface": "#e2e2e5",
      "on-primary": "#003355",
      "on-secondary": "#243240",
      "on-success": "#000000",
      "on-warning": "#000000",
      "on-error": "#690005",
      "on-info": "#FFFFFF"
    },
    "variables": {
      "border-color": "#e2e2e5",
      "border-opacity": 0.12,
      "high-emphasis-opacity": 0.87,
      "medium-emphasis-opacity": 0.6,
      "disabled-opacity": 0.38,
      "idle-opacity": 0.04,
      "hover-opacity": 0.04,
      "focus-opacity": 0.12,
      "selected-opacity": 0.08,
      "activated-opacity": 0.12,
      "pressed-opacity": 0.12,
      "dragged-opacity": 0.08,
      "theme-kbd": "#2C2C2C",
      "theme-on-kbd": "#FFFFFF",
      "theme-code": "#1E1E1E",
      "theme-on-code": "#FFFFFF"
    }
  }
}
```

:::

```ts
theme: {
  defaultTheme: 'system',
  themes: {
    light,
    dark,
  },
},
```

With `defaultTheme: 'system'`, Vuetify follows the operating system color scheme by default.

## Global defaults

Global component defaults live in `apps/web/src/themes/defaults.ts`:

```ts
export const defaults = {
  VCardActions: {
    VBtn: { variant: 'outlined' },
  },
}
```

This specific configuration means buttons inside `v-card-actions` use the `outlined` variant unless a component overrides it.

## Icons

To avoid bundling a large icon package blindly, the project exposes only the icons it uses through `apps/web/src/themes/icons.ts`:

```ts
import { mdiHome } from '@mdi/js'

export default { mdiHome }
```

Those icons are merged into Vuetify's SVG icon aliases:

```ts
icons: {
  defaultSet: 'mdi',
  aliases: {
    ...aliases,
    ...icons,
  },
  sets: {
    mdi,
  },
},
```

The custom alias can then be used as `$mdiHome` in templates.

## Sandbox page

Include a small demo page at `apps/web/src/pages/sandbox/index.vue`:

```vue
<template>
  <v-card prepend-icon="$mdiHome" title="Sandbox">
    <v-card-text>Content</v-card-text>
    <v-card-actions>
      <v-btn @click="theme.toggle()">Toggle theme</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'

const theme = useTheme()
</script>
```

## Verify the setup

Start the app from the workspace root:

```bash
pnpm --dir apps/web dev
```

Open `/sandbox` while the app is running to verify that:

- Vuetify components render correctly
- the custom `$mdiHome` icon alias resolves
- the theme toggle switches between the configured light and dark themes

## Icon auto-import (experimental)

Plugin to automatically re-generate `apps/web/src/themes/icons.ts` whenever user saves changes in file containing `$mdiIconName`:

::: details `apps\web\vite-plugin-autoimport-mdi-icons.ts`

```ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import * as mdi from '@mdi/js'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function generateContent(icons: string[]): string {
  const header =
    `/* eslint-disable */\n` +
    `/* prettier-ignore */\n` +
    `// @ts-nocheck\n` +
    `// noinspection JSUnusedGlobalSymbols\n` +
    `// Generated by vite-plugin-auto-import-mdi-icons\n\n`

  if (!icons.length) {
    return `${header}export default {}\n`
  }

  return (
    header +
    `import {\n\t${icons.join(',\n\t')}\n} from '@mdi/js'\n\n` +
    `export default {\n\t${icons.join(',\n\t')}\n}\n`
  )
}

type AutoImportMdiIconsOptions = {
  dirs?: string[]
  exts?: string[]
  pattern?: string
  outputPath?: string
  outputFile?: string
  log?: boolean
  failOnMissing?: boolean
}

export function AutoImportMdiIcons(options: AutoImportMdiIconsOptions = {}): Plugin {
  let config: ResolvedConfig

  const dirs = options.dirs ?? ['./src']
  const exts = options.exts ?? ['.vue', '.ts', '.md']
  const pattern = options.pattern ?? '$mdi'
  const outputPath = options.outputPath ?? './src/themes/'
  const outputFile = options.outputFile ?? 'icons.ts'
  const log = options.log ?? true
  const failOnMissing = options.failOnMissing ?? false

  const availableIcons = new Set(Object.keys(mdi))

  function logger(message: string): void {
    if (!log) return
    console.log(`\x1b[36m[Auto Import MDI Icons]\x1b[0m ${message}`)
  }

  function getOutputFilePath(): string {
    return path.resolve(config.root, outputPath, outputFile)
  }

  function isInsideDir(filePath: string, dir: string): boolean {
    const absoluteDir = path.resolve(config.root, dir)
    const relative = path.relative(absoluteDir, filePath)

    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative)
  }

  function shouldScanFile(filePath: string): boolean {
    if (!exts.includes(path.extname(filePath))) return false
    if (path.resolve(filePath) === getOutputFilePath()) return false

    return dirs.some((dir) => isInsideDir(filePath, dir))
  }

  function extractIcons(content: string): string[] {
    const regex = new RegExp(`${escapeRegex(pattern)}[A-Z][A-Za-z0-9]*`, 'g')

    return [...new Set(content.match(regex) ?? [])]
      .map((icon) => pattern.replace(/^\$/, '') + icon.slice(pattern.length))
      .toSorted()
  }

  async function collectIconsFromFile(filePath: string): Promise<string[]> {
    if (!shouldScanFile(filePath)) return []

    const content = await fs.readFile(filePath, 'utf-8')
    return extractIcons(content)
  }

  async function walkDir(dir: string): Promise<string[]> {
    const files: string[] = []

    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return files
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        files.push(...(await walkDir(fullPath)))
      } else if (entry.isFile() && shouldScanFile(fullPath)) {
        files.push(fullPath)
      }
    }

    return files
  }

  async function collectAllIcons(): Promise<string[]> {
    const icons = new Set<string>()

    for (const dir of dirs) {
      const absoluteDir = path.resolve(config.root, dir)
      const files = await walkDir(absoluteDir)

      for (const file of files) {
        for (const icon of await collectIconsFromFile(file)) {
          icons.add(icon)
        }
      }
    }

    return [...icons].toSorted()
  }

  function validateIcons(
    icons: string[],
    pluginContext: { warn(message: string): void; error(message: string): never },
  ) {
    const missing = icons.filter((icon) => !availableIcons.has(icon))

    if (!missing.length) return icons

    const message = `Unknown MDI icons: ${missing.join(', ')}`

    if (failOnMissing) {
      pluginContext.error(message)
    } else {
      pluginContext.warn(message)
    }

    return icons.filter((icon) => availableIcons.has(icon))
  }

  async function writeIfChanged(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    let existing = ''
    try {
      existing = await fs.readFile(filePath, 'utf-8')
    } catch {
      // File does not exist yet.
    }

    if (existing === content) return

    await fs.writeFile(filePath, content)
    logger(`updated ${path.relative(config.root, filePath)}`)
  }

  async function regenerate(pluginContext: {
    warn(message: string): void
    error(message: string): never
  }) {
    const output = getOutputFilePath()
    const icons = await collectAllIcons()
    const validIcons = validateIcons(icons, pluginContext)
    const content = generateContent(validIcons)

    await writeIfChanged(output, content)
  }

  return {
    name: 'auto-import-mdi-icons',

    configResolved(resolvedConfig) {
      config = resolvedConfig
    },

    async buildStart() {
      await regenerate(this)
    },

    async handleHotUpdate() {
      await regenerate(this)
    },
  }
}
```

:::

Import plugin into `apps\web\vite.config.ts`

```ts
//..
import { AutoImportMdiIcons } from './vite-plugin-autoimport-mdi-icons.ts'
//..

export default defineConfig({
  plugins: [
    //..
    AutoImportMdiIcons({}),
    //..
  ],
  //..
})
```
