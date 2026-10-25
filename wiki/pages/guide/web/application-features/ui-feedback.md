# UI Feedback

Use `useUi()` from `@/capabilities/ui`. It exposes a focused API backed by the application's
Pinia UI store; no application-store aggregation is required.

```ts
import { useUi } from '@/capabilities/ui'

const ui = useUi()
ui.info('Ready')
ui.success('Saved', { timeout: 3000 })
ui.warning('Please review this change')
ui.error(new Error('Save failed'))
ui.snack('Copied', { timeout: 1500 })
ui.clear()
```

`notification` is a read-only ref with `type`, `message`, and `presentation`
(`alert` or `snackbar`). `snackbar` and `loading.active` are read-only refs too.
When using the `ui` object directly, read nested refs with `.value`, including
in templates.

```ts
const finish = ui.loading.start('overlay.save')
try {
  await save()
} catch (error) {
  ui.error(error)
} finally {
  finish()
}
```

The default layout in `src/app/layouts` renders alerts, snackbars, and a loading
indicator. `useNotificationMessage()` from `@/capabilities/ui` translates known
catalog keys and displays arbitrary errors as plain text. Runtime error messages
are not submitted to the missing-translation collector.

Loading is keyed and reference-counted. `start(key)` returns an idempotent release
function: completing one operation cannot hide another, including operations with
the same key. Prefer `await ui.loading.run('orders.save', () => save())` when no
additional cleanup is needed. It returns the action's result and releases loading
on success, rejection, or a synchronous throw.

`loading.active.value` tracks all activity. `loading.has('auth.login')` tracks a
specific operation; `loading.has('auth')` also includes descendant keys such as
`auth.profile`. Application auth operations register their activity automatically.
Auth retains its private request guards and restoration deduplication; UI loading
does not control domain concurrency.

The app-bar progress indicator and contained main-content overlay both respond to
`loading.active.value`: any tracked operation activates them, including auth
refresh, profile requests, and sandbox activity. Keys identify operations; no
special `overlay` prefix is required. Both indicators remain active until all
tracked operations finish.

Use the sandbox UI page to exercise preferences and feedback.
