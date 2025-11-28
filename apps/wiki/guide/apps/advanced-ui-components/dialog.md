# Dialog

Modal dialog component with customizable title, content, actions, and layout options. Built on Vuetify's Dialog component with support for persistent, fullscreen, and scrollable modes.

## Overview

`VOvDialog` provides a flexible modal dialog wrapper for displaying content, forms, and user prompts. It supports customizable headers with titles, subtitles, and icons; formatted content with styling; flexible action buttons; and optional persistent, fullscreen, and scrollable layouts. The component handles click actions, form submissions, and cancellations with clear event emissions.

**Features:**
- Customizable title, subtitle, and icon
- Formatted content with styling support
- Flexible action buttons with custom formatting
- Built-in submit, cancel, and custom actions
- Persistent, fullscreen, and scrollable modes
- Responsive width based on screen breakpoints
- Slot support for complex content and forms
- v-model binding for dialog visibility
- Full TypeScript support

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-dialog.vue 
:::

## API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `persistent` | `boolean` | `false` | Prevent dialog from closing when clicking outside |
| `fullscreen` | `boolean` | `false` | Display dialog in fullscreen mode |
| `scrollable` | `boolean` | `false` | Enable scrolling for long content |
| `closeable` | `boolean` | `false` | Adds close button that closes the dialog |
| `copyable` | `boolean` | `false` | Adds copy to clipboard button |
| `title` | `string` | - | Dialog title text |
| `subtitle` | `string` | - | Dialog subtitle text (displayed below title) |
| `icon` | `string` | - | Icon to display in dialog header |
| `color` | `string` | - | Background color for dialog card |
| `content` | `string` | - | Dialog content text |
| `contentFormat` | `OvFormat \| OvFormat[]` | - | Formatting options for content |
| `actions` | `OvAction \| OvAction[]` | - | Action buttons to display at bottom |
| `actionFormat` | `OvFormat \| OvFormat[]` | - | Default formatting for all action buttons |
| `actionSubmit` | `string \| string[]` | - | Action name(s) that trigger submit event |
| `actionCancel` | `string \| string[]` | - | Action name(s) that trigger cancel event and close dialog |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `action` | `action: OvAction` | Emitted when any action button is clicked (except submit/cancel) |
| `submit` | `action: OvAction` | Emitted when an action marked as submit is clicked |
| `cancel` | - | Emitted when an action marked as cancel is clicked or before closing |

### Exposed Properties

| Property | Type | Description |
|----------|------|-------------|
| `dialog` | `Ref<boolean>` | Boolean ref for dialog visibility - can be used to open/close programmatically |

### Content Formatting

The `contentFormat` prop supports conditional formatting with validation rules:

```typescript
interface OvFormat {
  text?: string              // Override content text
  icon?: string              // Add icon to content
  color?: string             // Color styling
  variant?: string           // Button variant
  density?: string           // Content density
  size?: string              // Size adjustment
  rounded?: boolean          // Border radius
  class?: string             // Custom CSS class
  rules?: OvRule[]           // Conditional rules
}
```

When `contentFormat` includes formatting properties, the content is displayed as a chip instead of plain text.

### Action Format

Actions can be defined as:

**String (simple):**
```typescript
actions: ['close', 'cancel', 'submit']
```

**Object (with formatting):**
```typescript
actions: [
  { name: 'agree', format: { text: 'Agree', color: 'green' } },
  { name: 'disagree', format: { text: 'Disagree', color: 'red' } },
  { name: 'notify', format: { text: 'Notify Me', icon: '$mdiBell' } }
]
```

### Action Handler Logic

The component automatically routes actions based on the `actionSubmit` and `actionCancel` props:

1. If action name matches `actionCancel`, emits `cancel` event and closes dialog
2. If action name matches `actionSubmit`, emits `submit` event and closes dialog
3. Otherwise, emits `action` event and keeps dialog open

## Slots

### content

Slot for custom content instead of simple text:

```vue
<v-ov-dialog title="Dialog with Slot Content">
  <template v-slot:content="{ onClose }">
    <!-- Custom content here -->
    <v-btn @click="onClose">Close</v-btn>
  </template>
</v-ov-dialog>
```

Slot scope provides:
- `onClose()` - Function to close the dialog

### actions

Slot for custom action buttons:

```vue
<v-ov-dialog title="Dialog with Custom Actions">
  <template v-slot:actions>
    <v-btn color="primary">Custom Action</v-btn>
  </template>
</v-ov-dialog>
```

## Notes

- Dialog width respects the Vuetify breakpoint system and automatically adjusts to screen size
- Content displays as a chip (with styling) if `contentFormat` is provided; otherwise as plain text
- Multiple action names can be marked as submit/cancel by passing arrays: `actionSubmit="['agree', 'yes']"`
- The `persistent` prop requires users to use an action button to close the dialog
- Slot content has access to an `onClose` function for programmatic closure
- Icon supports Material Design Icon syntax (e.g., `$mdiAccount`, `$mdiAlert`)
- Dialog respects all Vuetify color system colors and theme customizations
