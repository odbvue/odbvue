# Map

## Overview

`VOvMap` is the Leaflet-based map component. It renders a GeoJSON feature collection, supports a simple point-editing mode, emits feature clicks, and exposes helpers for resetting the view and reading the current edit state.

## Dependencies

- `vue`
- `vuetify`
- `leaflet`
- `@vue-leaflet/vue-leaflet`

## Usage

```vue
<template>
  <v-ov-map :options="mapOptions" :geojson="geojson" @feature-click="onFeatureClick" />
</template>

<script setup lang="ts">
import type { OvGeoJson, OvMapOptions } from '@/components'

const mapOptions = ref<OvMapOptions>({
  center: [56.95, 24.11],
  zoom: 7,
  height: '420px',
  autoFit: false,
})

const geojson = ref<OvGeoJson | null>({
  type: 'FeatureCollection',
  features: [],
})
</script>
```

## API

### Props

| Prop                   | Type                                           | Default | Description                                                     |
| ---------------------- | ---------------------------------------------- | ------- | --------------------------------------------------------------- |
| `options`              | `OvMapOptions`                                 | `{}`    | Map configuration such as center, zoom, size, tiles, and icons. |
| `geojson`              | `OvGeoJson \| null`                            | `null`  | Feature collection to render on the map.                        |
| `loading`              | `boolean`                                      | `false` | Shows the contained loading overlay.                            |
| `padding`              | `boolean`                                      | `true`  | Adds container padding.                                         |
| `editable`             | `boolean`                                      | `false` | Enables edit mode for supported geometry.                       |
| `editableGeometryType` | `'Point' \| 'LineString' \| 'Polygon' \| null` | `null`  | Declares the editable geometry type.                            |
| `editableGeometry`     | `OvGeoJsonGeometry \| null`                    | `null`  | Initial geometry for edit mode.                                 |

### Emits

| Event           | Payload   | Description                                         |
| --------------- | --------- | --------------------------------------------------- |
| `feature-click` | `feature` | Emitted when a rendered GeoJSON feature is clicked. |

### Exposed

| Property                | Type                                                                                            | Description                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `resetCenter()`         | `() => void`                                                                                    | Resets the map to the original center or the last fitted bounds. |
| `getEditState()`        | `() => { geometry: OvGeoJsonGeometry \| null; valid: boolean; dirty: boolean; points: number }` | Returns the current edit state.                                  |
| `clearEditedGeometry()` | `() => void`                                                                                    | Clears the current editable geometry.                            |

### Slots

None.

### Notes

- The current edit implementation only renders and mutates `Point` geometry, even though the prop type accepts `LineString` and `Polygon`.
- When `geojson` is present and `autoFit` is not `false`, the map fits the bounds automatically.
- Feature property text is sanitized before popup content is assembled.
- `options.center` and `options.zoom` default to a Latvia-centered view when omitted.
