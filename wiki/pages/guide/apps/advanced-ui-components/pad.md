# Pad

## Overview

`VOvPad` is a canvas-based drawing surface with freehand and shape drawing, eraser support, undo/redo history, and export helpers. It handles mouse, touch, and pointer input directly and keeps the rendered image in sync with the emitted data URL.

## Dependencies

- `vue`

## Usage

```vue
<template>
  <v-ov-pad
    ref="pad"
    width="100%"
    height="240px"
    :lock="locked"
    :color="color"
    :background-color="backgroundColor"
    @update:image="image = $event"
  />
</template>

<script setup lang="ts">
const pad = ref()
const locked = ref(false)
const color = ref('#000000')
const backgroundColor = ref('white')
</script>
```

## API

### Props

| Prop               | Type                                                                        | Default       | Description                                                               |
| ------------------ | --------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| `strokeType`       | `'dash' \| 'line' \| 'square' \| 'circle' \| 'triangle' \| 'half_triangle'` | `'dash'`      | Drawing mode.                                                             |
| `fillShape`        | `boolean`                                                                   | `false`       | Fills geometric shapes instead of outlining them.                         |
| `image`            | `string`                                                                    | `''`          | Legacy image prop retained for compatibility.                             |
| `eraser`           | `boolean`                                                                   | `false`       | Switches the brush into eraser mode.                                      |
| `color`            | `string`                                                                    | `'#000000'`   | Stroke color.                                                             |
| `lineWidth`        | `number`                                                                    | `5`           | Stroke width.                                                             |
| `lineCap`          | `'round' \| 'square' \| 'butt'`                                             | `'round'`     | Canvas line cap.                                                          |
| `lineJoin`         | `'miter' \| 'round' \| 'bevel'`                                             | `'miter'`     | Canvas line join.                                                         |
| `lock`             | `boolean`                                                                   | `false`       | Disables editing actions when enabled.                                    |
| `backgroundColor`  | `string`                                                                    | `'#FFFFFF'`   | Canvas background color.                                                  |
| `backgroundImage`  | `string`                                                                    | `null`        | Background image URL.                                                     |
| `saveAs`           | `'jpeg' \| 'png'`                                                           | `'png'`       | Export format.                                                            |
| `canvasId`         | `string`                                                                    | random string | Canvas element id.                                                        |
| `initialImage`     | `Stroke[]`                                                                  | `[]`          | Initial strokes to preload.                                               |
| `additionalImages` | `Stroke[]`                                                                  | `[]`          | Accepted by the prop surface, but not used in the current implementation. |
| `outputWidth`      | `number`                                                                    | canvas width  | Export width.                                                             |
| `outputHeight`     | `number`                                                                    | canvas height | Export height.                                                            |
| `width`            | `string \| number`                                                          | `'100%'`      | Container width.                                                          |
| `height`           | `string \| number`                                                          | `'100%'`      | Container height.                                                         |

### Emits

| Event          | Payload  | Description                               |
| -------------- | -------- | ----------------------------------------- |
| `update:image` | `string` | Emitted with the current canvas data URL. |

### Exposed

| Method             | Type                                        | Description                                  |
| ------------------ | ------------------------------------------- | -------------------------------------------- |
| `clear()`          | `() => void`                                | Clears the canvas without resetting state.   |
| `reset()`          | `() => void`                                | Clears all strokes and history.              |
| `undo()`           | `() => void`                                | Removes the last stroke.                     |
| `redo()`           | `() => void`                                | Restores the last undone stroke.             |
| `save()`           | `() => string \| undefined`                 | Exports the canvas and emits `update:image`. |
| `startDraw(event)` | `(event: MouseEvent \| TouchEvent) => void` | Starts a stroke.                             |
| `draw(event)`      | `(event: MouseEvent \| TouchEvent) => void` | Updates the current stroke.                  |
| `stopDraw()`       | `() => void`                                | Finalizes the current stroke.                |
| `handleResize()`   | `() => Promise<void>`                       | Recomputes the canvas size and redraws.      |

### Slots

None.

### Notes

- `lock` blocks draw, undo, redo, and reset operations.
- The component redraws itself on window resize.
- `additionalImages` and `image` are accepted props, but the current source only uses `initialImage` for preload behavior.
- `saveAs` controls the export MIME type used by `save()`.
