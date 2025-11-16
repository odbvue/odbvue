# Share

Social media sharing and clipboard functionality component with support for multiple platforms and customizable button styling.

## Overview

`VOvShare` is a versatile social sharing component that enables users to easily share content across multiple social media platforms. It provides integrated sharing buttons for Twitter, Facebook, LinkedIn, and WhatsApp, along with a copy-to-clipboard option. The component supports native behavior for mobile devices and allows customization of button styling through Vuetify props.

**Features:**
- Multi-platform social sharing (Twitter, Facebook, LinkedIn, WhatsApp)
- Copy-to-clipboard functionality with fallback support
- Customizable share platforms
- Native mobile behavior support
- Configurable window positioning for share dialogs
- Button styling customization (variant, density, color)
- TypeScript support with proper type definitions
- Full integration with vue-socials library

## Dependencies

```bash
pnpm add vue-socials
```

- [vue-socials](https://www.npmjs.com/package/vue-socials) - Social media share components

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-share.vue 
:::

## API

### Props

#### Share Platforms

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `share` | `Share[]` | `['twitter', 'facebook', 'linkedin', 'whatsapp', 'copy']` | Array of enabled share platforms. Options: `'twitter'`, `'facebook'`, `'linkedin'`, `'whatsapp'`, `'copy'` |

#### Share Content

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `shareOptions` | `ShareOptions` | `{ number: '' }` | Share content and metadata (see ShareOptions below) |

#### Window Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `windowFeatures` | `WindowFeatures` | `{ url: '' }` | Share dialog window positioning (see WindowFeatures below) |
| `useNativeBehavior` | `boolean` | `false` | Use native mobile share behavior instead of opening popup windows |

#### Button Styling

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'flat' \| 'text' \| 'elevated' \| 'tonal' \| 'outlined' \| 'plain'` | `undefined` | Vuetify button variant styling |
| `density` | `'default' \| 'comfortable' \| 'compact'` | `undefined` | Vuetify button density (spacing) |
| `color` | `string` | `undefined` | Button color (CSS color or Vuetify theme color) |
| `class` | `string \| string[] \| Record<string, boolean>` | `undefined` | CSS class attributes for buttons |

### Type Definitions

#### Share
Union type for supported share platforms:
```typescript
type Share = 'twitter' | 'facebook' | 'linkedin' | 'whatsapp' | 'copy'
```

#### ShareOptions
Configuration object for share content:
```typescript
type ShareOptions = {
  text?: string          // Share text/message
  url: string            // URL to share (required)
  via?: string           // Twitter: account to mention
  hashtags?: string[]    // Twitter: hashtags to include
  number: string         // WhatsApp: phone number
  quote?: string         // Facebook: quote for shared content
}
```

#### WindowFeatures
Configuration for share dialog window positioning:
```typescript
type WindowFeatures = {
  width: number          // Window width in pixels
  height: number         // Window height in pixels
  top: number            // Distance from top in pixels
  left: number           // Distance from left in pixels
}
```

### Events

The component does not emit custom events. Social sharing is handled through platform-specific APIs or native sharing behavior.

### Methods

The component exposes an internal method for clipboard operations:

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `copyToClipboard()` | - | `void` | Copy the text from `shareOptions.text` to clipboard with fallback for older browsers |
