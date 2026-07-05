# File Based Routing

## Overview

The web app uses Vue Router 5 file-based routing through the official Vite plugin exposed by `vue-router/vite`.

Routes are generated from files in `src/pages`:

- `src/pages/index.vue` becomes `/`
- `src/pages/about.md` becomes `/about`

Markdown pages are compiled as Vue components with `unplugin-vue-markdown`, and frontmatter is merged into `route.meta` with `gray-matter`.

## Install the dependencies

Install the router, Markdown loader, and frontmatter parser:

```bash
pnpm install vue-router
pnpm install -D gray-matter unplugin-vue-markdown
```

## Configure Vite

Update `apps/web/vite.config.ts` to enable both file-based routing and Markdown pages:

```ts
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'
import vue from '@vitejs/plugin-vue'
import Markdown from 'unplugin-vue-markdown/vite'
import vueDevTools from 'vite-plugin-vue-devtools'

import { readFile } from 'node:fs/promises'
import matter from 'gray-matter'

const metaCache = new Map<string, Record<string, unknown>>()

export async function extractMetaFromMarkdown(filePath: string) {
  if (metaCache.has(filePath)) return metaCache.get(filePath)!

  try {
    const content = await readFile(filePath, 'utf-8')
    const { data } = matter(content)
    metaCache.set(filePath, data)
    return data
  } catch (error) {
    console.warn(`[vue-router] Failed to extract meta from ${filePath}`, error)
    return {}
  }
}

export default defineConfig({
  plugins: [
    VueRouter({
      extensions: ['.vue', '.md'],
      async extendRoute(route) {
        if (route.component?.endsWith('.md')) {
          const meta = await extractMetaFromMarkdown(route.component)
          route.meta = { ...route.meta, ...meta }
        }
      },
    }),
    vue({
      include: [/\.vue$/, /\.md$/],
    }),
    Markdown({}),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

## Router setup

Modify router to handle auto generated routes and hot updates:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router

if (import.meta.hot) {
  handleHotUpdate(router)
}
```

## Create pages

Vue files and Markdown files under `src/pages` are both treated as route components.

### Vue page

`src/pages/index.vue`

```vue
<template>
  <h1>Home</h1>
  <p>Hallo OdbVue</p>
</template>

<route>
  {
    "meta": {
      "title": "Home"
    },
  }
</route>
```

The optional `<route>` block is a good place for route-specific metadata on `.vue` pages.

### Markdown page

`src/pages/about.md`

```md
---
title: About
---

# About

This is an `About` page
```

Because `extendRoute()` reads frontmatter with `gray-matter`, the `title` field is available on `route.meta.title`.

## Render the routes

`App.vue` only needs standard Vue Router components:

```vue
<template>
  <router-link to="/">Home</router-link>
  |
  <router-link to="/about">About</router-link>
  <br />
  <br />
  <router-view />
</template>
```

## Verify the setup

Start the app:

```ps
pnpm --dir apps/web dev
```

Running the app generates `typed-router.d.ts`. Commit that file so route names and params stay typed across the project. If your editor does not pick up the generated declarations automatically, add `typed-router.d.ts` to the `include` list in `apps/web/tsconfig.json`.

You should be able to navigate between `/` and `/about`, with both routes generated from the files in `src/pages` and to see route meta data in dev tools for both - `*.vue` and `*.md` files.
