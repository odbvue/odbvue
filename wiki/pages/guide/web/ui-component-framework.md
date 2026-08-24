# UI and Themes

OdbVue uses [Vuetify](https://vuetifyjs.com/) as its UI implementation. `@odbvue/web` owns Vuetify styles, the Material Design 3 blueprint, the MDI icon set, and runtime installation. Applications configure only their UI choices under `ui` in `odbvue.config.ts`.

Use the [Vuetify documentation](https://vuetifyjs.com/components/all/) for component APIs. Do not add `createVuetify()` or a Vuetify plugin to the application.

## Themes

Keep substantial palettes in an application-owned file, then register them through configuration.

```ts
import { light, dark } from './src/themes/themes.json'

export default defineOdbVueApp({
  ui: {
    theme: { default: 'system', light, dark },
  },
})
```

`default` selects the initial theme. `system` follows the operating-system preference; use `light` or `dark` to select a fixed palette.

## Component defaults

Use `ui.defaults` for application-wide component choices.

```ts
ui: {
  defaults: {
    VCardActions: {
      VBtn: { variant: 'outlined' },
      class: 'd-flex flex-wrap justify-end',
    },
  },
}
```

## Icons

`ui.icons` adds application aliases to OdbVue's MDI aliases. Keep the mapping in an application file such as `src/themes/icons.ts`; `mdiHome` then becomes `$mdiHome` in templates.
