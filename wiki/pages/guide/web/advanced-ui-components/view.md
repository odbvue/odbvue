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

| Prop      | Type                        | Default         | Description                                                             |
| --------- | --------------------------- | --------------- | ----------------------------------------------------------------------- |
| `data`    | `OvViewData`                | required        | Data object keyed by item names.                                        |
| `options` | `OvViewOptions`             | `{ items: [] }` | View configuration.                                                     |
| `loading` | `boolean`                   | `false`         | Shows a contained overlay on the view, or on its form dialog when open. |
| `t`       | `(text?: string) => string` | identity        | Translation function.                                                   |

### Emits

| Event     | Payload                               | Description                                                            |
| --------- | ------------------------------------- | ---------------------------------------------------------------------- |
| `details` | `(name, value)`                       | Emitted when a truncated value is expanded.                            |
| `action`  | `(name, value, formData?, complete?)` | Emitted for item and grid actions. Generated forms provide completion. |

Generated action forms own their submission loading; no parent `saving` ref is
needed. Call the supplied `OvActionComplete` callback on every outcome:

- `{ status: 'success' }` closes the dialog. The parent owns updates to view data.
- `{ status: 'invalid', errors }` keeps the draft open and shows field errors.
- `{ status: 'error' }` keeps the draft open for retry; the handler reports the error.

Completion ends submission loading. Previous field errors clear on the next submission.
Duplicate completions and completions after unmount are ignored. Ordinary actions
without a generated form do not receive completion. The shared `refetch` success
flag applies only to tables; views do not fetch data.

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
- `locale`: optional locale override for date/time formatting; defaults to the current i18n locale.

### Dates and Timestamps

Pass service data unchanged and declare presentation in the item options:

```ts
const options: OvViewOptions = {
  items: [
    { name: 'birthday', format: { tsFormat: 'date' } },
    { name: 'createdAt', format: { tsFormat: 'datetime' } },
    { name: 'startTime', format: { tsFormat: 'time' } },
  ],
}
```

`VOvView` and `VOvTable` share this formatter. The named styles use the current
locale and browser time zone, update when the locale changes, and accept ISO
timestamp strings or `Date` objects. Date-only strings retain their calendar date.
Empty values stay empty; invalid timestamps are logged and remain visible.
Legacy `tsFormat` masks remain supported.

### Notes

- Single items still render through the same formatter pipeline, but without the larger grid wrapper.
- Item formatting uses the first matching format entry from `OvFieldFormat`.
- `details` is emitted only when a value is truncated.
- Action forms open a modal form when the action definition includes `form`.
