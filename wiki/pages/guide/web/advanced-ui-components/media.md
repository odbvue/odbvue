# Media

## Overview

`VOvMedia` switches between playback and capture flows for video and audio. It can render a remote source, start a camera or microphone stream, capture snapshots, and record to base64 or Blob output.

## Dependencies

- `vue`
- `vuetify`

## Usage

```vue
<template>
  <v-ov-media video snap format="blob" @snapped="onSnap" @recorded="onRecorded" @error="onError" />
</template>

<script setup lang="ts">
function onSnap(value: Blob) {
  console.log(value)
}
</script>
```

## API

### Props

| Prop               | Type                                                                 | Default         | Description                                     |
| ------------------ | -------------------------------------------------------------------- | --------------- | ----------------------------------------------- |
| `src`              | `string \| null`                                                     | `null`          | Remote media source for playback.               |
| `autoplay`         | `boolean`                                                            | `true`          | Starts playback automatically.                  |
| `loop`             | `boolean`                                                            | `false`         | Loops playback.                                 |
| `video`            | `boolean`                                                            | `false`         | Enables video playback or recording mode.       |
| `audio`            | `boolean`                                                            | `false`         | Enables audio playback or recording mode.       |
| `recorderPosition` | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'`       | `'bottom-left'` | Position of the record button.                  |
| `snap`             | `boolean`                                                            | `false`         | Shows the snapshot button for video mode.       |
| `snapPosition`     | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'`       | `'top-right'`   | Position of the snapshot button.                |
| `snapIcon`         | `string`                                                             | `'$mdiCamera'`  | Icon used by the snapshot button.               |
| `format`           | `'base64' \| 'blob'`                                                 | `'base64'`      | Output type for snapshots and recordings.       |
| `videoConstraints` | `MediaTrackConstraints`                                              | `{}`            | Constraints passed to `getUserMedia` for video. |
| `audioConstraints` | `MediaTrackConstraints`                                              | `{}`            | Constraints passed to `getUserMedia` for audio. |
| `compact`          | `boolean`                                                            | `false`         | Uses icon-only controls and smaller spacing.    |
| `variant`          | `'outlined' \| 'flat' \| 'text' \| 'elevated' \| 'tonal' \| 'plain'` | `'flat'`        | Button variant.                                 |
| `density`          | `'default' \| 'comfortable' \| 'compact'`                            | `'default'`     | Button density.                                 |

### Emits

| Event      | Payload                                          | Description                                                        |
| ---------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `loading`  | `boolean`                                        | Emitted while the component is starting or stopping device access. |
| `device`   | `{ devices: MediaDeviceInfo[]; device: string }` | Emitted after device enumeration.                                  |
| `started`  | `string \| { video: string; audio: string }`     | Emitted when playback or recording starts.                         |
| `stopped`  | -                                                | Emitted when recording or camera access stops.                     |
| `snapped`  | `string \| Blob`                                 | Emitted with a captured snapshot.                                  |
| `recorded` | `string \| Blob`                                 | Emitted with a completed recording.                                |
| `error`    | `Error`                                          | Emitted when media access or capture fails.                        |

### Exposed

| Method / Property     | Type                         | Description                                     |
| --------------------- | ---------------------------- | ----------------------------------------------- |
| `listDevices()`       | `() => MediaDeviceInfo[]`    | Returns the filtered list of available devices. |
| `setDevice(deviceId)` | `(deviceId: string) => void` | Selects a camera or microphone device.          |
| `audioPlayback()`     | `() => Promise<void>`        | Toggles audio playback.                         |
| `videoRecording()`    | `() => Promise<void>`        | Toggles recording.                              |
| `isPlaying`           | `Ref<boolean>`               | Current audio playback state.                   |

### Slots

| Slot    | Scope | Description                                             |
| ------- | ----- | ------------------------------------------------------- |
| default | -     | Renders custom overlay content above the media surface. |

### Notes

- If `src` is provided, the component stays in playback mode and skips device startup.
- At least one of `video` or `audio` must be `true` for capture mode.
- `format` controls the payload type for both snapshot and recording events.
- The source declares `paused` and `resumed` events, but the current implementation does not emit them.
