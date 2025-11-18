# View

Lightweight display component for rendering structured data with conditional formatting, icons, labels, and item-level actions. Perfect for presenting read-only details or quick-access data with visual enhancements.

## Overview

`VOvView` provides a flexible data display solution with configurable items, custom formatting rules, and action buttons. Displays single items inline or multiple items in a responsive grid layout with automatic column distribution. Supports conditional formatting, icon rendering, value truncation with detail modal, and item-specific actions with full TypeScript support.

**Features:**
- Single-item inline display or multi-item grid layout
- Responsive column layout with auto-sizing
- Conditional formatting with validation rules
- Icon support with custom colors and styling
- Item labels with optional display
- Value truncation with detail view modal
- Item-level actions with custom handlers
- Grid-level actions (print, export, etc.)
- Loading state with overlay indicator
- Full TypeScript support

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-view.vue 
:::

## API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `OvViewData` | - | **Required.** Data object with key-value pairs matching item names |
| `options` | `OvViewOptions` | `undefined` | View configuration with items, columns, and actions |
| `loading` | `boolean` | `false` | Show loading overlay with spinner |
| `t` | `(text?: string) => string` | `(text) => text` | Translation/localization function for labels and messages |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `details` | `itemName: string, value: string` | Emitted when detail button clicked for truncated value |
| `action` | `actionName: string, value: unknown` | Emitted when item action or grid action triggered |

### View Options

```typescript
interface OvViewOptions {
  // Required
  items: OvViewItem[]

  // Optional - Layout
  cols?: number
  maxLength?: number

  // Optional - Actions
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
  actionAlign?: 'left' | 'center' | 'right'
}
```

### Item Definition

Items define what data to display and how to format it:

```typescript
interface OvViewItem {
  // Required
  name: string

  // Optional - Display
  label?: string
  maxLength?: number

  // Optional - Formatting
  format?: OvFormat | OvFormat[]

  // Optional - Actions
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
}
```

#### Item Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | **Required.** Unique item identifier matching data object key |
| `label` | `string` | Display label above the value (optional) |
| `maxLength` | `number` | Character limit for display (0 = always show detail button, undefined = no truncation) |
| `format` | `OvFormat \| OvFormat[]` | Conditional formatting rules for item styling |
| `actions` | `OvAction[]` | Array of actions available for this item |
| `actionFormat` | `OvFormat \| OvFormat[]` | Default formatting for actions on this item |

### Display Modes

#### Single Item Display

When only one item is provided, it renders inline without container or grid:

```typescript
{
  data: { name: 'John Doe' },
  options: {
    items: [{ name: 'name' }]
  }
}
```

Renders as: `<span>John Doe</span>`

#### Multi-Item Grid Display

With multiple items, renders in a responsive grid layout:

```typescript
{
  options: {
    cols: 3,  // 3 columns on desktop, 1 on mobile
    items: [
      { name: 'name' },
      { name: 'email' },
      { name: 'phone' }
    ]
  }
}
```

- **Desktop**: 3-column layout (1920px+)
- **Mobile**: Single column layout (automatically on small screens)

## Notes

- Single-item display renders inline without container or grid wrapper
- Multiple items automatically use responsive grid layout
- Mobile devices always render single-column layout regardless of `cols` setting
- Unformatted items display as plain text spans
- Formatted items render as Vuetify chips with colors and icons
- All labels and messages respect the `t` translation function
- Actions with `hidden: true` format don't render
- Detail modal uses readonly textarea to prevent accidental edits
- Links use `href` for standard links, `to` for Vue Router navigation
- Loading overlay prevents interaction during async operations
- Grid actions render in separate row below all items
- Item value substitution in links happens at render time, not template parse time
