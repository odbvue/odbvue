# UI and Themes

OdbVue uses [Vuetify](https://vuetifyjs.com/) as its UI implementation. `apps/web/src/capabilities/ui` exports Vuetify with its styles, the Material Design 3 blueprint, and the MDI icon set. `main.ts` installs it directly, using choices under `ui` in `odbvue.config.ts`. Shared `VOv*` components live in `src/components` and compile directly with the application.

Use the [Vuetify documentation](https://vuetifyjs.com/components/all/) for component APIs. Extend the existing application setup rather than installing a second Vuetify instance.

## Themes

Keep substantial palettes in an application-owned file, then register them through configuration.

```ts
import type { AppConfig } from './src/capabilities/config'
import { light, dark } from './src/capabilities/ui/themes/themes.json'

export default {
  ui: {
    theme: { default: 'system', light, dark },
  },
} satisfies AppConfig
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

`ui.icons` adds application aliases to OdbVue's MDI aliases. The application MDI plugin generates `src/capabilities/ui/themes/icons.ts`; `mdiHome` then becomes `$mdiHome` in templates.
