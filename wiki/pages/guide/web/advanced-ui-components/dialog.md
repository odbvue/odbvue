# Dialog

## Overview

`VOvDialog` wraps `v-dialog` and `v-card` into a small action-driven dialog. It supports `v-model` or `activator`-driven opening, optional copy and close controls, formatted content, and action routing for submit/cancel/custom buttons.

## Dependencies

- `vue`
- `vuetify`
- `vue-i18n`

## Usage

```vue
<template>
  <v-btn>
    Open dialog
    <v-ov-dialog
      activator="parent"
      title="Sample Dialog"
      content="Content for the dialog"
      actions="close"
      actionCancel="close"
    />
  </v-btn>
</template>
```

## API

### Props

| Prop            | Type                     | Default | Description                                       |
| --------------- | ------------------------ | ------- | ------------------------------------------------- |
| `modelValue`    | `boolean`                | `false` | Controls visibility when `activator` is not used. |
| `activator`     | `string`                 | -       | Activator selector passed to `v-dialog`.          |
| `persistent`    | `boolean`                | `false` | Prevents closing by clicking outside.             |
| `fullscreen`    | `boolean`                | `false` | Uses fullscreen dialog mode.                      |
| `scrollable`    | `boolean`                | `false` | Enables scrollable dialog content.                |
| `closeable`     | `boolean`                | `false` | Shows a close button in the footer.               |
| `copyable`      | `boolean`                | `false` | Shows a copy-to-clipboard button for `content`.   |
| `title`         | `string`                 | -       | Card title.                                       |
| `subtitle`      | `string`                 | -       | Card subtitle.                                    |
| `icon`          | `string`                 | -       | Header icon.                                      |
| `color`         | `string`                 | -       | Card color.                                       |
| `content`       | `string`                 | -       | Plain text or HTML content.                       |
| `contentFormat` | `OvFormat \| OvFormat[]` | -       | Formatting for `content`.                         |
| `actions`       | `OvAction \| OvAction[]` | -       | Footer action buttons.                            |
| `actionFormat`  | `OvFormat \| OvFormat[]` | -       | Default formatting for action buttons.            |
| `actionSubmit`  | `string \| string[]`     | -       | Action name(s) treated as submit.                 |
| `actionCancel`  | `string \| string[]`     | -       | Action name(s) treated as cancel.                 |

### Emits

| Event               | Payload    | Description                                                    |
| ------------------- | ---------- | -------------------------------------------------------------- |
| `update:modelValue` | `boolean`  | Emitted when the dialog is opened or closed in `v-model` mode. |
| `action`            | `OvAction` | Emitted for non-submit/cancel actions.                         |
| `submit`            | `OvAction` | Emitted for submit actions.                                    |
| `cancel`            | -          | Emitted for cancel actions.                                    |

### Exposed

None.

### Slots

| Slot      | Scope         | Description                                                |
| --------- | ------------- | ---------------------------------------------------------- |
| `content` | `{ onClose }` | Replaces the body content area.                            |
| `actions` | `{ onClose }` | Appends custom action controls after the built-in buttons. |

### Notes

- When `activator` is set, the component manages its own open state instead of `modelValue`.
- `contentFormat.html` renders sanitized HTML and shows a warning banner.
- `actionSubmit` and `actionCancel` accept a string or an array of names.
- `copyable` copies `content` to the clipboard and falls back to a textarea-based copy path.
