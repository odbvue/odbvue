# Map

Interactive map component powered by Google Maps with marker management, geolocation support, and customizable center/zoom controls.

## Overview

`VOvMap` provides a Vue 3 wrapper around the Google Maps JavaScript API with advanced features like automatic geolocation, marker management, and real-time event handling. The component supports marker creation, deletion, info windows, and automatic centering based on user location.

**Features:**
- Google Maps integration with custom styling
- Automatic geolocation with optional auto-centering
- Marker management (add, remove, retrieve)
- Advanced markers with info windows
- Customizable center, zoom, and marker colors
- Event emission for map interactions (click, zoom, center, locate)
- Full TypeScript support
- Responsive sizing with custom width/height

## Dependencies

```bash
pnpm add vue3-google-map
```

- **vue3-google-map**: Vue 3 Google Maps wrapper with Advanced Markers support

## Configuration

Set your Google Maps API key in the environment variables:

```env
VITE_GOOGLE_MAP_API_KEY=your_api_key_here
```

> [!WARNING]
> If publishing API key to repo and when using in production, make sure that domain restrictions are applied.

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-map.vue 
:::

## API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `center` | `{ lat: number; lng: number }` | `{ lat: 0, lng: 0 }` | Map center coordinates |
| `zoom` | `number` | `10` | Initial zoom level (1-21) |
| `markers` | `TOvMapMarker[]` | `[]` | Array of markers to display on the map |
| `autoCenter` | `boolean` | `true` | Auto-center map on detected location |
| `autoLocation` | `boolean` | `true` | Automatically detect user's current location |
| `width` | `string` | `'100%'` | Container width (CSS value) |
| `height` | `string` | `'100%'` | Container height (CSS value) |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `centered` | `{ lat: number; lng: number }` | Emitted when map center changes |
| `zoomed` | `number` | Emitted when zoom level changes |
| `located` | `{ lat: number; lng: number }` | Emitted when user location is detected |
| `marked` | `TOvMapMarker[]` | Emitted when markers are added, removed, or updated |
| `clicked` | `{ lat: number; lng: number }` | Emitted when map is clicked with coordinates |
| `loading` | `boolean` | Emitted when geolocation loading state changes |

### Exposed Methods and Properties

| Name | Type | Description |
|------|------|-------------|
| `location` | `{ lat: number; lng: number }` | Current user's detected location |
| `loading` | `boolean` | Geolocation loading state |
| `getMarkers()` | `() => TOvMapMarker[]` | Returns current array of markers |
| `setMarkers(markers)` | `(markers: TOvMapMarker[]) => void` | Add or update markers (merges with existing) |
| `delMarkers(markers)` | `(markers: TOvMapMarker[]) => void` | Remove markers by matching coordinates |

### Marker Type

```typescript
interface TOvMapMarker {
  lat: number           // Latitude coordinate
  lng: number           // Longitude coordinate
  title?: string        // Marker title (displayed on hover)
  color?: string        // Pin background color (CSS color name or hex)
  info?: string         // HTML content displayed in info window on click
}
```

### Component Instance Type

```typescript
interface VOvMapInstance {
  location: { lat: number; lng: number }
  getMarkers: () => TOvMapMarker[]
  setMarkers: (markers: TOvMapMarker[]) => void
  delMarkers: (markers: TOvMapMarker[]) => void
  loading: boolean
}
```

## Behavior

### Geolocation

When `autoLocation` is `true`, the component automatically requests the user's current location on mount using the Geolocation API. If successful, it emits the `located` event and optionally centers the map if `autoCenter` is `true`. If `autoLocation` is `false`, the map displays at the specified `center` coordinates.

### Marker Management

- **setMarkers**: Adds new markers or updates existing ones. Deduplicates markers with identical coordinates.
- **delMarkers**: Removes markers matching the provided latitude/longitude coordinates.
- **getMarkers**: Returns the current array of all markers.

### Marker Info Windows

Markers can display clickable info windows containing HTML content via the `info` property. The HTML content is rendered directly, allowing for rich formatting.

### Marker Colors

Markers use Advanced Markers with customizable pin colors. Common color values: `blue`, `red`, `green`, `purple`, `yellow`, etc.

## Notes

- The map requires a valid Google Maps API key with Maps JavaScript API and Geolocation API enabled
- Geolocation requests require HTTPS in production environments
- Marker info windows display on marker click
- The component uses ResizeObserver patterns internally for responsive behavior
- Map interactions (pan, zoom, click) are properly debounced for performance
- Marker deduplication uses latitude/longitude values as unique identifiers

