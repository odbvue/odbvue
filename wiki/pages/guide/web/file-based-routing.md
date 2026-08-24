# Routing and Pages

OdbVue applications use file-based pages. Create route components under `src/pages`; the OdbVue routing convention turns their location into a URL.

- `src/pages/index.vue` becomes `/`.
- `src/pages/about.vue` becomes `/about`.
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

Application developers create pages and metadata; router creation and route HMR are framework behavior. Running the app updates `typed-router.d.ts`, which should remain committed for typed route names and parameters.
