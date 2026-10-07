# Preferences

UI preferences are application state, not database settings. Use
`usePreferencesStore()` from `@/capabilities/ui`; its implementation lives in
`src/capabilities/ui/preferences.ts`.

```ts
import { usePreferencesStore } from '@/capabilities/ui'

const preferences = usePreferencesStore()
preferences.setTheme('dark')
preferences.toggleTheme()
preferences.setLocale('fr')
preferences.setFontSize(150)
```

The Pinia store exposes theme, available themes, theme icon, locale, available
locales, font size, and available font sizes. Its watchers update the installed
Vuetify and Vue I18n instances and the root document font size.

Only `theme`, `locale`, and `fontSize` are persisted in localStorage, using the
existing `settings` store identifier so existing preferences survive upgrades.
Authentication, user details, and tokens are never included.

The default layout consumes this store directly for its theme, locale, and
font-size controls. Sandbox also uses the same store for diagnostics. There is no
intermediate application-store aggregation or second Vuetify/i18n installation.

Configure supported locales and brand themes in `odbvue.config.ts`. Invalid
preference inputs follow the store's existing warnings and supported-value defaults.
