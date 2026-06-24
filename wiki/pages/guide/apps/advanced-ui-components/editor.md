# Editor

## Overview

`VOvEditor` wraps TipTap into a markdown-first editor with a compact toolbar, validation hooks, image insertion support, and utility methods for reading back HTML or markdown. The current implementation binds markdown in `v-model`, not HTML.

## Dependencies

- `vue`
- `vuetify`
- `@tiptap/vue-3`
- `@tiptap/starter-kit`
- `@tiptap/markdown`
- `@tiptap/extension-image`

## Usage

```vue
<template>
  <v-ov-editor
    ref="editor"
    v-model="content"
    label="Article body"
    :toolbar="['bold', 'italic', 'heading', 'bulletList', 'orderedList']"
    toolbar-class="mb-4"
  />

  <pre>{{ output.markdown }}</pre>
</template>

<script setup lang="ts">
const editor = ref()
const content = ref('# Hello world')

const output = computed(() => ({
  html: editor.value?.getHTML?.() ?? '',
  markdown: editor.value?.getMarkdown?.() ?? '',
}))
</script>
```

## API

### Props

| Prop            | Type                                                | Default      | Description                                   |
| --------------- | --------------------------------------------------- | ------------ | --------------------------------------------- |
| `modelValue`    | `string`                                            | `''`         | Markdown content bound with `v-model`.        |
| `label`         | `string`                                            | -            | Field label shown above the editor.           |
| `placeholder`   | `string`                                            | -            | Placeholder text for the editor surface.      |
| `hint`          | `string`                                            | -            | Helper text shown below the editor.           |
| `toolbar`       | `string[]`                                          | built-in set | Toolbar button ids to render.                 |
| `toolbarClass`  | `string`                                            | `''`         | Extra class for the toolbar container.        |
| `editorClass`   | `string`                                            | `''`         | Extra class for the editor content container. |
| `minHeight`     | `string`                                            | `'150px'`    | Minimum editor height.                        |
| `maxHeight`     | `string`                                            | `'400px'`    | Maximum editor height before scrolling.       |
| `disabled`      | `boolean`                                           | `false`      | Disables editing and toolbar buttons.         |
| `readonly`      | `boolean`                                           | `false`      | Renders the editor read-only.                 |
| `variant`       | `'outlined' \| 'filled' \| 'underlined' \| 'plain'` | `'outlined'` | Visual variant for the wrapper.               |
| `rules`         | `((value: unknown) => boolean \| string)[]`         | -            | Local validation rules.                       |
| `errorMessages` | `string[]`                                          | -            | External validation messages.                 |
| `counter`       | `number`                                            | -            | Character counter limit.                      |
| `color`         | `string`                                            | -            | Reserved styling prop.                        |
| `imageUploader` | `(file: File) => Promise<{ url: string } \| null>`  | -            | Upload handler for the image toolbar action.  |

### Emits

| Event               | Payload  | Description                                                  |
| ------------------- | -------- | ------------------------------------------------------------ |
| `update:modelValue` | `string` | Emitted with the current markdown when the document changes. |

### Exposed

| Property          | Type                                              | Description                          |
| ----------------- | ------------------------------------------------- | ------------------------------------ |
| `editor`          | `Editor`                                          | Underlying TipTap editor instance.   |
| `focus(position)` | `(position?: 'start' \| 'end' \| number) => void` | Focuses the editor.                  |
| `getHTML()`       | `() => string`                                    | Returns the current HTML output.     |
| `getMarkdown()`   | `() => string`                                    | Returns the current markdown output. |

### Slots

| Slot    | Scope | Description                         |
| ------- | ----- | ----------------------------------- |
| `label` | -     | Replaces the default label content. |

### Notes

- The `toolbar` list is filtered against the built-in button map; unknown ids are ignored.
- The toolbar is hidden when the editor is disabled or readonly.
- The component exposes markdown in `v-model`; use `getHTML()` if you need rendered HTML.
- The sandbox page listens for `updated`, but the current source only emits `update:modelValue`.
