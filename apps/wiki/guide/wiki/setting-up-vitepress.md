# Setting up VitePress

## What is VitePress

[VitePress](https://vitepress.dev/) is a modern, VueJS based static site generator designed specifically for writing and serving documentation. It's built on top of Vite, a fast and lean development server and build tool.

## Creating Wiki

1. Install VitePress in your web application directory so it can reuse same node packages and common resources.

```bash
cd apps
pnpm add -D vitepress
pnpm vitepress init
```

2. Follow the setup wizard.

```
┌  Welcome to VitePress!
│
◇  Where should VitePress initialize the config?
│  ./
│
◇  Where should VitePress look for your markdown files?
│  ./wiki
│
◇  Site title:
│  OdbVue
│
◇  Site description:
│  Take Ownership of Your Future
│
◇  Theme:
│  Default Theme + Customization
│
◇  Use TypeScript for config and theme files?
│  Yes
│
◇  Add VitePress npm scripts to package.json?
│  Yes
│
◇  Add a prefix for VitePress npm scripts?
│  Yes
│
◇  Prefix for VitePress npm scripts:
│  wiki
│
└  Done! Now run pnpm run wiki:dev and start writing.
```

This will create all vitepress configuration in `./apps/.vitpress/`, but the documentation content in a root level `./apps/wiki/`.

3. Exclude vitepress cache from being put in source control by adding to `./apps/.gitignore`

```
.vitepress/cache/
```

4. Apply prettier formatting to vitepress by modifying `./apps/package.json`

```
    "format": "prettier --write src/ .vitepress/",
```

5. Exclude vitepress cache from linting by modifying `./apps/eslint.config.ts`

```
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/cache/**']),
```

6. For now disable linting errors in theme customization `./apps/.vitepress/theme/index.ts`

```ts{14}
// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    })
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  enhanceApp({ app, router, siteData }) {
    // ...
  },
} satisfies Theme
```

## Test and build wiki

### Development

```bash
pnpm wiki:dev
```

### Validate

```bash
pnpm format
pnpm lint
pnpm type-check
```

### Build for production

```bash
pnpm wiki:build
```
