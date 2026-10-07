# Routing and Pages

OdbVue applications use file-based pages. Main-application routes live under `src/app/pages`; module routes live under `src/modules/<module>/pages`. The Vite configuration scans only those page folders, not module components or layouts.

- `src/app/pages/index.vue` becomes `/`.
- `src/app/pages/about.vue` becomes `/about`.
- `src/modules/sandbox/pages/index.vue` becomes `/sandbox`.
- `src/modules/sandbox/pages/capabilities/auth.vue` becomes `/sandbox/capabilities/auth`.
- Vue and Markdown page files are supported.

## Page metadata

Use `definePage()` in Vue pages to provide route metadata used by the application shell.

```vue
<script setup lang="ts">
definePage({
  meta: {
    title: 'Customers',
    layout: 'default',
  },
})
</script>
```

For Markdown pages, frontmatter contributes the same metadata.

```md
---
title: About
---

# About
```

The application owns router creation and route HMR under `src/app/router`. Module metadata is inferred from the page's source folder. Adding a new module's `pages` folder requires restarting Vite; edits within existing modules use route HMR. Running the app updates `typed-router.d.ts`, which should remain committed for typed route names and parameters.
