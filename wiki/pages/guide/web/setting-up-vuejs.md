# Web Overview

An OdbVue web application is built with Vue and uses Vuetify for its UI, but it does not start by assembling those libraries. `@odbvue/web` provides OdbVue configuration access and the standard Vuetify runtime, including its styles, Material Design 3 blueprint, and MDI icon set.

The application starts with `odbvue.config.ts`, then adds business pages, components, stores, translations, and brand choices under `src/`.

```text
apps/web/
  odbvue.config.ts     # Application-level choices
  src/
    pages/             # Business pages
    components/        # Business UI
    i18n/              # Application messages
    themes/            # Optional brand palettes and icon aliases
    services/          # Generated ORDS/OpenAPI client
```

Do not create a Vue application with `create-vue` or manually configure Vuetify for an OdbVue app. Those are framework concerns. Use the existing app as the starting point, then configure and extend it.

See [Web Configuration](/guide/web/web-configuration) for application choices, [UI and Themes](/guide/web/ui-component-framework) for branding, and [Routing and Pages](/guide/web/file-based-routing) for page conventions.
