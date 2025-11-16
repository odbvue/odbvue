# Pad

Interactive drawing and sketching component with support for multiple stroke types, shapes, colors, and undo/redo functionality.

## Overview

`VOvPad` is a versatile drawing canvas component that enables freehand drawing, shape creation, and sketching capabilities. It supports multiple stroke types (dash, line, square, circle, triangle, half_triangle), customizable colors and line styles, background images, and complete undo/redo history. The component is fully touch-compatible and responds to mouse, touch, and pointer events.

**Features:**
- 6 stroke types with shape guides and real-time preview
- Freehand drawing with customizable brush properties
- Shape filling and styling options
- Eraser functionality with background color awareness
- Complete undo/redo history tracking
- Touch, mouse, and pointer event support
- Background image support with scaling
- Canvas locking to prevent modifications
- Export to PNG or JPEG with custom dimensions
- Full TypeScript support

## Dependencies

No external dependencies required. The component uses native Canvas API.

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-pad.vue 
:::

## API

### Props

#### Dimensions

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `string \| number` | `'100%'` | Canvas container width (CSS value or pixels) |
| `height` | `string \| number` | `'100%'` | Canvas container height (CSS value or pixels) |

#### Drawing Settings

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color` | `string` | `'#000000'` | Drawing color (hex format) |
| `lineWidth` | `number` | `5` | Brush stroke width in pixels |
| `lineCap` | `'round' \| 'square' \| 'butt'` | `'round'` | Line ending style |
| `lineJoin` | `'miter' \| 'round' \| 'bevel'` | `'miter'` | Line join style |

#### Stroke Type

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `strokeType` | `'dash' \| 'line' \| 'square' \| 'circle' \| 'triangle' \| 'half_triangle'` | `'dash'` | Current drawing mode |
| `fillShape` | `boolean` | `false` | Fill shapes instead of stroking outlines |

#### Background & Canvas

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `backgroundColor` | `string` | `'#FFFFFF'` | Canvas background color (hex format) |
| `backgroundImage` | `string \| null` | `null` | Background image URL or data URI |
| `canvasId` | `string` | random | Unique identifier for canvas element |

#### Canvas Behavior

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `eraser` | `boolean` | `false` | Enable eraser mode (uses backgroundColor) |
| `lock` | `boolean` | `false` | Prevent drawing, undo, redo, and reset operations |

#### Output Format

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `saveAs` | `'jpeg' \| 'png'` | `'png'` | Export format |
| `outputWidth` | `number` | canvas width | Custom output image width |
| `outputHeight` | `number` | canvas height | Custom output image height |

#### Image Data

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialImage` | `Stroke[]` | `[]` | Pre-drawn strokes to load on mount |
| `additionalImages` | `Stroke[]` | `[]` | Additional image layers |
| `image` | `string` | `''` | Legacy image prop for compatibility |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:image` | `string` (data URL) | Emitted when canvas is saved or modified |

### Exposed Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `clear()` | - | `void` | Clear all canvas content without resetting state |
| `reset()` | - | `void` | Reset canvas to initial state (requires `lock: false`) |
| `undo()` | - | `void` | Undo last stroke (requires `lock: false`) |
| `redo()` | - | `void` | Redo last undone stroke (requires `lock: false`) |
| `save()` | - | `string` | Export canvas as data URL and emit `update:image` |
| `startDraw()` | `event` | `void` | Begin drawing stroke from event coordinates |
| `draw()` | `event` | `void` | Continue drawing (throttled to ~60fps) |
| `stopDraw()` | - | `void` | Finalize current stroke and add to history |
| `handleResize()` | - | `void` | Manually trigger canvas resize (called automatically on window resize) |

### Stroke Types

#### Dash
Free-hand drawing with customizable brush properties.

```typescript
startDraw()  // Begin stroke
draw(event)  // Draw freehand line as mouse moves
stopDraw()   // Finish and save stroke
```

#### Line
Click-drag to create straight line with guide preview.

```typescript
startDraw()  // Click to set start point
draw(event)  // Drag to show line guide
stopDraw()   // Release to finalize line
```

#### Square
Click-drag to create rectangular shape.

```typescript
startDraw()  // Click to set first corner
draw(event)  // Drag to show preview rectangle
stopDraw()   // Release to finalize square
```

#### Circle
Click-drag to create circular shape based on radius.

```typescript
startDraw()  // Click to set center
draw(event)  // Drag to adjust radius
stopDraw()   // Release to finalize circle
```

#### Triangle
Click-drag to create triangle shape.

```typescript
startDraw()  // Click to set first point
draw(event)  // Drag to show triangle guide
stopDraw()   // Release to finalize triangle
```

#### Half Triangle
Click-drag to create half-triangle (right triangle).

```typescript
startDraw()  // Click to set first point
draw(event)  // Drag to show half-triangle guide
stopDraw()   // Release to finalize shape
```
