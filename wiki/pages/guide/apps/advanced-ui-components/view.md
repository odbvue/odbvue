# View

## Overview

`VOvView` renders read-only item data as a responsive grid. Each item can be formatted, truncated, or turned into an action target, and the component opens a detail dialog when a value is shortened.

## Dependencies

- `vue`
- `vuetify`
- `vue-i18n`

## Usage

```vue
<template>
  <v-ov-view :data="data" :options="options" @action="onAction" />
</template>

<script setup lang="ts">
import type { OvViewOptions } from '@/components'

const data = ref({ name: 'Sample', status: 'active' })

const options = <OvViewOptions>{
  cols: 2,
  items: [{ name: 'name' }, { name: 'status' }],
}
</script>
```

## API

### Props

| Prop      | Type                        | Default         | Description                      |
| --------- | --------------------------- | --------------- | -------------------------------- |
| `data`    | `OvViewData`                | required        | Data object keyed by item names. |
| `options` | `OvViewOptions`             | `{ items: [] }` | View configuration.              |
| `loading` | `boolean`                   | `false`         | Shows the loading overlay.       |
| `t`       | `(text?: string) => string` | identity        | Translation function.            |

### Emits

| Event     | Payload                               | Description                                 |
| --------- | ------------------------------------- | ------------------------------------------- |
| `details` | `(name, value)`                       | Emitted when a truncated value is expanded. |
| `action`  | `(name, value, formData?, callback?)` | Emitted for item and grid actions.          |

### Exposed

None.

### Slots

None.

### View Options

`options` accepts:

- `items`: array of `{ name, label, format, actions, actionFormat, maxLength }`.
- `cols`: number of grid columns.
- `actions`: grid-level actions.
- `actionFormat`: default formatting for actions.
- `actionAlign`: alignment for the action row.
- `maxLength`: default truncation limit.
- `t`: optional translation function used by nested action formatting.

### Notes

- Single items still render through the same formatter pipeline, but without the larger grid wrapper.
- Item formatting uses the first matching format entry from `OvFieldFormat`.
- `details` is emitted only when a value is truncated.
- Action forms open a modal form when the action definition includes `form`.
