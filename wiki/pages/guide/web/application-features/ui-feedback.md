# UI Feedback

Use `useUi()` from `@/app/ui`. It exposes a focused API backed by the application's
Pinia UI store; no application-store aggregation is required.

```ts
import { useUi } from '@/app/ui'

const ui = useUi()
ui.info('Ready')
ui.success('Saved', { timeout: 3000 })
ui.warning('Please review this change')
ui.error(new Error('Save failed'))
ui.snack('Copied', { timeout: 1500 })
ui.clear()
```

`notification` is a read-only ref with `type`, `message`, and `presentation`
(`alert` or `snackbar`). `snackbar` and `loading` are read-only refs too.
When using the `ui` object directly, read nested refs with `.value`, including
in templates.

```ts
ui.startLoading()
try {
  await save()
} catch (error) {
  ui.error(error)
} finally {
  ui.stopLoading()
}
```

The default layout in `src/app/layouts` renders alerts, snackbars, and a loading
indicator. `useNotificationMessage()` from `@/app/composables/ui` translates known
catalog keys and displays arbitrary errors as plain text. Runtime error messages
are not submitted to the missing-translation collector.

Use the sandbox UI page to exercise preferences and feedback. Authentication
loading is independently supplied by `useAuth()`.
