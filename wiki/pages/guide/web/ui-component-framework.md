# UI and Themes

OdbVue uses [Vuetify](https://vuetifyjs.com/) as its UI implementation. `apps/web/src/capabilities/ui` exports Vuetify with its styles, the Material Design 3 blueprint, and the MDI icon set. `main.ts` installs it directly, using choices under `ui` in `odbvue.config.ts`. Shared `VOv*` components live in `src/components` and compile directly with the application.

Use the [Vuetify documentation](https://vuetifyjs.com/components/all/) for component APIs. Extend the existing application setup rather than installing a second Vuetify instance.

## JSON viewer

Use `VOvJson` to display JSON without a schema or display configuration:

```vue
<v-ov-json :data="data" />
```

It automatically renders objects as key/value tables and nested containers as
named sections. Arrays of flat objects with the same keys become data tables
with inferred columns; key order may differ between records. All records are
displayed without paging. Primitive arrays become compact lists; mixed or complex
arrays become recursive panels with zero-based indices. Nested containers use
Vuetify expansion panels: the first two levels start open, and deeper sections
start collapsed and render their contents on expansion.

Booleans use check/cross icons and translated text. Strings and numbers appear as
plain text, multiline strings preserve line breaks, and null and empty containers
are muted. Exact property names are preserved, including table headers. Strings
are never interpreted as HTML or translation keys.

A raw JSON toggle and copy button always provide the complete original document.

Optional loading and error inputs keep request handling in the page:

```vue
<v-ov-json :data="data" :loading="loading" :error="error" />
```

Loading takes precedence over errors and data. Errors may be translation keys or
plain messages. An absent (`undefined`) input displays an empty state; `null` is
a JSON value. Pass parsed JSON, not serialized text: strings are displayed as strings.
Unsupported values (including circular references, nested `undefined`, non-finite
numbers, functions, and class instances) show an error. Clipboard failures are
also shown explicitly. Both raw display and copying include the whole document,
independent of expanded branches. Select only fields appropriate for display
before passing sensitive API responses.

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
