# Editor

Rich text editor component powered by TipTap with configurable formatting toolbar and HTML/Markdown conversion.

## Overview

`VOvEditor` provides a lightweight yet powerful rich text editor wrapper around TipTap. It supports multiple formatting options (bold, italic, underline, strike, lists, headings) with a customizable toolbar. The component handles content synchronization via v-model and emits update events.

**Features:**
- Multiple formatting options (bold, italic, underline, strike, lists, headings)
- Configurable toolbar with custom styling
- v-model support for two-way content binding
- HTML and Markdown output conversion
- Full TypeScript support
- Responsive Material Design icons

## Dependencies

```bash
pnpm add @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit turndown pretty
pnpm i --save-dev @types/turndown @types/pretty
```

- **@tiptap/vue-3@2**: Vue 3 integration for TipTap
- **@tiptap/starter-kit@2**: Core TipTap extensions bundle
- **turndown**: HTML to Markdown converter
- **pretty**: HTML formatter for pretty-printed output

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-editor.vue 
:::

## API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `string` | `''` | v-model: The HTML content of the editor |
| `toolbar` | `string[]` | `[]` | Array of button IDs to display in toolbar |
| `toolbarClass` | `string` | `''` | CSS class to apply to toolbar container |
| `editorClass` | `string` | `''` | CSS class to apply to editor content area |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `string` | Emitted when content changes (v-model) |
| `updated` | `string` | Emitted when editor content is updated with formatted HTML |

### Exposed Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getHTML()` | `string` | Returns formatted HTML content |
| `getMarkdown()` | `string` | Returns Markdown representation of content |
| `editor` | `Editor` | Access to underlying TipTap editor instance |

### Toolbar Buttons

Available toolbar button IDs:

| ID | Icon | Description |
|----|------|-------------|
| `bold` | FormatBold | Toggle bold formatting |
| `italic` | FormatItalic | Toggle italic formatting |
| `underline` | FormatUnderline | Toggle underline formatting |
| `strike` | FormatStrikethrough | Toggle strikethrough formatting |
| `bulletList` | FormatListBulleted | Toggle unordered list |
| `orderedList` | FormatListNumbered | Toggle ordered list |
| `heading1` | FormatHeader1 | Toggle heading level 1 |
| `heading2` | FormatHeader2 | Toggle heading level 2 |
| `heading3` | FormatHeader3 | Toggle heading level 3 |

## Styling

The editor uses scoped styles with deep selectors to style the ProseMirror editor instance:

- `.editor-toolbar` - Toolbar container (receives `toolbarClass` prop)
- `.editor-content` - Editor content wrapper (receives `editorClass` prop)

## Notes

- The toolbar buttons are automatically filtered based on the `toolbar` prop - only specified buttons are rendered
- Active formatting state is reflected in button variant (outlined when active)
- Content is synchronized in real-time through v-model
- Editor instance is properly destroyed on component unmount to prevent memory leaks
