# Media

Universal media component for video playback, video recording, audio playback, and audio recording with device management and snapshot capture.

## Overview

`VOvMedia` provides a flexible media component that supports both playback and recording of video and audio streams. It can play remote media files via `src` prop or record from device cameras and microphones. The component includes features for device selection, snapshot capture, customizable button positioning, and comprehensive event handling.

**Features:**
- Video playback and recording
- Audio playback and recording
- Multiple media device support with device enumeration
- Snapshot capture (base64 or blob format)
- Customizable button positioning and styling
- Recording time display
- Compact and full UI modes
- Browser-based MediaStream API integration
- Full TypeScript support

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-media.vue 
:::

## API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string \| null` | `null` | Media source URL (video or audio file) |
| `autoplay` | `boolean` | `true` | Auto-play media when ready |
| `loop` | `boolean` | `false` | Loop media playback |
| `video` | `boolean` | `false` | Enable video (playback or recording) |
| `audio` | `boolean` | `false` | Enable audio (playback or recording) |
| `recorderPosition` | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | `'bottom-left'` | Position of record button |
| `snap` | `boolean` | `false` | Show snapshot button (video only) |
| `snapPosition` | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | `'top-right'` | Position of snapshot button |
| `snapIcon` | `string` | `'$mdiCamera'` | Material Design icon for snapshot button |
| `format` | `'base64' \| 'blob'` | `'base64'` | Format for snapshots and recordings |
| `videoConstraints` | `MediaTrackConstraints` | `{}` | Browser MediaStream video constraints |
| `audioConstraints` | `MediaTrackConstraints` | `{}` | Browser MediaStream audio constraints |
| `compact` | `boolean` | `false` | Compact UI mode (icon-only buttons, no controls text) |
| `variant` | `'outlined' \| 'flat' \| 'text' \| 'elevated' \| 'tonal' \| 'plain'` | `'flat'` | Vuetify button variant |
| `density` | `'default' \| 'comfortable' \| 'compact'` | `'default'` | Vuetify button density |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `loading` | `boolean` | Emitted when starting/stopping media device access |
| `device` | `{ devices: MediaDeviceInfo[]; device: string }` | Emitted when device list is available |
| `started` | `string \| { video: string; audio: string }` | Emitted when recording starts |
| `paused` | - | Emitted when recording is paused |
| `resumed` | - | Emitted when recording is resumed |
| `stopped` | - | Emitted when recording stops |
| `snapped` | `string \| Blob` | Emitted with snapshot (base64 string or Blob) |
| `recorded` | `string \| Blob` | Emitted with recording (base64 string or Blob) |
| `error` | `Error` | Emitted when an error occurs |

### Exposed Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `listDevices()` | - | `MediaDeviceInfo[]` | Get list of available media devices |
| `setDevice(deviceId: string)` | `deviceId` | `void` | Switch to specific media device |
| `audioPlayback()` | - | `Promise<void>` | Toggle audio playback |
| `videoRecording()` | - | `Promise<void>` | Toggle video recording |

### Exposed Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `isPlaying` | `Ref<boolean>` | Current audio playback state |

