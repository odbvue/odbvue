# Application Module

## Overview

The Application module provides the core framework and essential features for building modern Vue.js web applications with OdbVue. It encompasses the foundational architecture including layouts, navigation, settings management, internationalization, authentication, authorization, and accessibility features. The module delivers a complete, production-ready application shell with responsive design, theme support, and progressive web app capabilities.

## User Stories

- **Navigate Application**: Users can navigate through the application using the navigation drawer menu, breadcrumbs, and page cards with consistent routing behavior
- **Customize Settings**: Users can personalize their experience by changing themes (light/dark), language locale, and font size with settings persisted across sessions
- **Multi-language Support**: Users can switch between supported languages (English, French, German) with all UI text automatically translated
- **Authenticate**: Users can sign up, log in, recover password, confirm email, and reset password through a complete authentication flow
- **Access Protected Content**: Authenticated users can access role-protected pages based on their assigned permissions and roles
- **Explore REST API**: Authenticated users can browse interactive API documentation, view endpoint specifications, test API calls with live execution, and copy responses
- **Accessible Experience**: Users with assistive technologies benefit from dynamic page titles, skip links, route announcements, and proper focus management
- **Offline Capability**: Users can install the application as a PWA and access cached content offline
- **Responsive Design**: Users experience optimal layouts across all device sizes from mobile to desktop

## Architecture

### Technology Stack

- **Vue.js 3**: Progressive JavaScript framework with Composition API
- **TypeScript**: Strongly typed programming language for better tooling
- **Vuetify 3**: Material Design component framework with MD3 blueprint
- **Vue Router**: File-based routing with unplugin-vue-router
- **Pinia**: State management with persistence support
- **Vue I18n**: Internationalization plugin for multi-language support
- **Vite**: Next-generation build tool with Hot Module Replacement

### Project Structure

```
apps/src/
├── components/        # Reusable Vue components
├── composables/       # Composition API utilities
├── i18n/             # Translation files by locale
├── layouts/          # Layout components (Default, Fullscreen)
├── pages/            # File-based routing pages
├── plugins/          # Vue plugins (Vuetify, i18n)
├── router/           # Router configuration
├── stores/           # Pinia stores (settings, navigation, ui)
└── themes/           # Theme configurations
```

## Core Features

### Layouts

Layouts provide reusable page wrappers defining shared structure and UI elements.

- **DefaultLayout**: Full application shell with navigation drawer, app bar, breadcrumbs, settings controls, alerts, loading indicators, and footer
- **FullscreenLayout**: Minimal wrapper for authentication pages and error screens

Layout selection is automatic based on route meta configuration:
```vue
<route>
  { meta: { layout: 'fullscreen' } }
</route>
```

### Navigation

The navigation system provides:

- **Navigation Drawer**: Collapsible sidebar with menu items generated from route definitions
- **Breadcrumbs**: Dynamic breadcrumb trail showing current location in navigation hierarchy
- **Page Cards**: Home page displays navigation cards for all top-level pages with icons and descriptions

### Settings

User preferences are managed through the Settings store with local storage persistence:

- **Theme**: Toggle between light and dark themes with system preference detection
- **Locale**: Switch between supported languages (en, fr, de)
- **Font Size**: Adjust text size (75%, 100%, 125%, 150%)

### Internationalization

Multi-language support powered by Vue I18n:

- **Translation Files**: Organized by locale in `@/i18n/` directory
- **Page-specific Translations**: Nested translation files per page module
- **Dynamic Loading**: Translations loaded via unplugin-vue-i18n

### File-based Routing

Routes are automatically generated from the file system using unplugin-vue-router:

- **Vue Files**: `@/pages/*.vue` become routes
- **Markdown Files**: `@/pages/*.md` support static content pages
- **Dynamic Routes**: `[param].vue` for dynamic segments
- **Catch-all**: `[...path].vue` for 404 handling

## API

### Application Context

- `GET /api/` - Get application context
  - Response: version, user (if authenticated), consents
  - Used to initialize application state on load

### Authentication Endpoints

- `POST /api/login/` - User authentication
  - Parameters: username, password
  - Response: tokens (access, refresh), user data

- `POST /api/signup/` - User registration
  - Parameters: email, username, password, fullname
  - Response: confirmation email sent

- `POST /api/confirm-email/` - Email verification
  - Parameters: token
  - Response: account activated

- `POST /api/recover-password/` - Password recovery initiation
  - Parameters: email
  - Response: recovery email sent

- `POST /api/reset-password/` - Password reset completion
  - Parameters: token, password
  - Response: password updated

- `POST /api/refresh/` - Token refresh
  - Parameters: refresh_token
  - Response: new access token

- `POST /api/logout/` - User logout
  - Response: tokens invalidated

## Stores

### Application Store (`useAppStore`)

Central store aggregating all application-level stores:
- `settings`: Theme, locale, font size preferences
- `navigation`: Pages, breadcrumbs, titles
- `ui`: Loading state, alerts, snackbars

### Settings Store (`useSettingsStore`)

Manages user preferences with persistence:
- `theme`: Current theme name
- `locale`: Current language code
- `fontSize`: Current font size percentage
- `toggleTheme()`: Switch between light/dark
- `setLocale(locale)`: Change language
- `setFontSize(size)`: Adjust text size

### Navigation Store (`useNavigationStore`)

Manages application navigation state:
- `pages`: All navigable pages with metadata
- `breadcrumbs`: Current breadcrumb trail
- `title(path)`: Get page title by path

### UI Store (`useUiStore`)

Manages UI feedback state:
- `loading`: Loading overlay visibility
- `info`, `warning`, `error`, `success`: Alert messages
- `snack`: Snackbar message
- `startLoading()`, `stopLoading()`: Control loading state
- `setInfo()`, `setWarning()`, `setError()`, `setSuccess()`: Display alerts
- `setSnack(message, timeout)`: Show snackbar notification
- `clearMessages()`: Clear all alerts

## UI Views (Pages)

1. **Home** (`/`) - Application landing page
   - Displays navigation cards for all top-level pages
   - Shows page icons, titles, and descriptions
   - Responsive grid layout

2. **About** (`/about`) - Application information
   - Markdown content page
   - Application overview and documentation

3. **Login** (`/login`) - User authentication
   - Username/password form
   - Links to signup and password recovery
   - Google OAuth integration (optional)

4. **Sign Up** (`/signup`) - User registration
   - Registration form with validation
   - Email confirmation workflow

5. **Recover Password** (`/recover-password`) - Password recovery
   - Email input for recovery link

6. **Reset Password** (`/reset-password/[token]`) - Password reset
   - New password form with token validation

7. **Confirm Email** (`/confirm-email/[token]`) - Email verification
   - Token validation and account activation

8. **Sandbox** (`/sandbox`) - Development testing
   - UI component demonstrations
   - Alert and loading testing
   - Protected routes and features testing

9. **REST API** (`/rest`) - Interactive API documentation
   - Displays all available API modules with version information
   - Expandable endpoint panels showing method, path, and description
   - Parameters documentation with type, location (path/query/header), and required status
   - Request body schema display
   - Response codes and schema documentation
   - "Try it out" functionality with parameter inputs and request body editor
   - Live API execution with response display
   - Copy response to clipboard
   - Security indicator for protected endpoints

10. **Page Not Found** (`/[...path]`) - 404 error page
   - Fullscreen layout
   - Navigation back to home

## Accessibility

### Dynamic Page Titles

Page titles update automatically on navigation using Unhead:
- Screen readers announce new pages
- Browser tabs display current page name
- Improves orientation for all users

### Skip Link

Keyboard-accessible anchor at page top:
- Visible on focus (Tab key)
- Jumps directly to main content
- Bypasses navigation elements

### Route Announcer

Hidden live region for screen readers:
- Announces page changes in SPAs
- Provides context without visual disruption

### Focus Management

Automatic focus handling on navigation:
- Focus moves to main heading after route change
- Ensures predictable keyboard navigation
- Supports smooth scrolling

## Security

### Authentication

- **Token-based**: JWT access and refresh tokens
- **Stateless**: Server validates tokens without session state
- **Secure Storage**: Tokens stored appropriately in browser
- **Auto-refresh**: Access tokens refreshed before expiration

### Authorization

- **Role-based Access Control**: Pages protected by role requirements
- **Route Guards**: Navigation prevented for unauthorized users
- **Page Meta Configuration**:
  - `access`: 'public' | 'authenticated' | 'with-role'
  - `visibility`: 'public' | 'authenticated' | 'with-role'
  - `roles`: Array of required role names

### Page Meta Security Example

```vue
<script setup lang="ts">
definePage({
  meta: {
    access: 'with-role',
    visibility: 'with-role',
    roles: ['admin'],
  },
})
</script>
```

## Progressive Web App

### Capabilities

- **Installable**: Add to home screen on mobile and desktop
- **Offline Support**: Service worker caches essential assets
- **App-like Experience**: Standalone display mode
- **Push Notifications**: Optional notification support

### Configuration

PWA configuration in `vite.config.ts`:
- **Manifest**: App name, icons, theme colors
- **Service Worker**: Caching strategies
- **Icons**: Generated from logo.svg using @vite-pwa/assets-generator

## Theming

### Material Design 3

Vuetify configured with MD3 blueprint for modern design language.

### Custom Themes

Light and dark themes defined in `@/themes/themes.json`:
- Primary, secondary, and accent colors
- Surface and background colors
- Error, warning, info, success colors

### Global Defaults

Component defaults in `@/themes/defaults.ts`:
- Consistent button variants
- Card action alignment
- Typography settings
