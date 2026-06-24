# Share

## Overview

`VOvShare` renders a row of social share buttons plus an optional copy button. It delegates the actual network share behavior to `vue-socials` and only handles button selection, styling, and clipboard fallback.

## Dependencies

- `vue`
- `vuetify`
- `vue-socials`

## Usage

```vue
<template>
  <v-ov-share :share-options="shareOptions" :share="['twitter', 'linkedin', 'copy']" color="red" />
</template>

<script setup lang="ts">
import type { ShareOptions } from '@/components/VOvShare.vue'

const shareOptions = ref<ShareOptions>({
  url: 'https://example.com',
  text: 'Check this out',
  via: 'odbvue',
  hashtags: ['vue', 'ui'],
  number: '+15555555555',
})
</script>
```

## API

### Props

| Prop                | Type                                            | Default                                                   | Description                                  |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| `share`             | `Share[]`                                       | `['twitter', 'facebook', 'linkedin', 'whatsapp', 'copy']` | Enabled share targets.                       |
| `windowFeatures`    | `WindowFeatures`                                | source default object                                     | Window sizing and position for popup shares. |
| `shareOptions`      | `ShareOptions`                                  | source default object                                     | Share payload passed to `vue-socials`.       |
| `useNativeBehavior` | `boolean`                                       | `false`                                                   | Uses native share behavior where supported.  |
| `variant`           | Vuetify button variant                          | `undefined`                                               | Button variant styling.                      |
| `density`           | Vuetify button density                          | `undefined`                                               | Button density styling.                      |
| `color`             | `string`                                        | `undefined`                                               | Button color.                                |
| `class`             | `string \| string[] \| Record<string, boolean>` | `undefined`                                               | Extra button classes.                        |

### Emits

None.

### Exposed

None.

### Slots

None.

### Notes

- `shareOptions.url` should always be provided, even though the source default is incomplete.
- `windowFeatures` should be passed with `width`, `height`, `top`, and `left` for predictable popup placement.
- The copy button uses the Clipboard API when available and falls back to `document.execCommand('copy')`.
