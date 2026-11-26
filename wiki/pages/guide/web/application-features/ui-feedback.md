# UI Feedback

Use `useUi()` from `@/capabilities/ui`. It exposes a focused API backed by the application's
Pinia UI store; no application-store aggregation is required.

```ts
import { useUi } from '@/capabilities/ui'

const ui = useUi()
ui.info('Ready')
ui.success('Saved', { timeout: 3000 })
ui.warning('Please review this change')
ui.error('Save failed')
ui.snack('Copied', { timeout: 1500 })
ui.alert('Maintenance is scheduled', { type: 'warning' })
ui.clearAlert()
ui.clearSnackbars()
ui.clear()
```

The default layout renders action feedback through Vuetify's `v-snackbar-queue`, one
message at a time, without custom notification containers or page movement.
Success, info, warning, and error messages use their corresponding severity color.
Each message is closable and defaults to five seconds once displayed; an explicit
`timeout` overrides this, and `{ timeout: 0 }` keeps a message until dismissed.
`ui.snack()` queues an info message too.

Use `ui.alert(message, { type: 'warning' })` for a separate, persistent page alert.
It defaults to type `info` and stays visible until closed, replaced, or cleared;
an optional positive `timeout` expires it. The default layout renders it in a
`v-app-bar` containing a `v-alert`, so showing or hiding it changes the page's
available space. Showing an alert replaces only the previous alert, not snackbars.
Action feedback and queued snackbars do not hide an active page alert.
`ui.clearAlert()` clears only the alert; `ui.clearSnackbars()` clears only displayed
and pending snackbars. `ui.clear()` clears both.

`notifications` is a read-only ref containing all undismissed notifications.
Each has an `id`, `type`, `message`, `timeout`, and `presentation: 'alert' | 'snackbar'`.
`notification` is a read-only ref to the active page alert, or otherwise the latest
undismissed snackbar. `snackbar` indicates whether that notification is a snackbar.
The layout acknowledges each
Vuetify dismissal with `ui.dismiss(id)`; `ui.clear()` clears displayed and pending messages.
Vuetify owns display timing, so waiting messages do not expire before being shown.
Messages are translated when rendered, including after a locale change.
The UI store is the single source of truth: each notification tracks whether it is
pending or already presented. Its writable computed `notificationQueue` adapts only
snackbar notifications to Vuetify's model; consuming a queue item does not dismiss it.
`useNotificationQueue(ui)` connects the renderer's lifecycle and clear action.
Layouts do not maintain a second notification array or copy messages with watchers.
Undismissed snackbars are requeued when the renderer unmounts; alerts never enter the queue.
When using the `ui` object directly, read nested refs with `.value`, including
in templates.

```ts
const finish = ui.loading.start('orders.save')
try {
  await save()
} catch (error) {
  ui.error(error)
} finally {
  finish()
}
```

The default layout in `src/app/layouts` renders the page alert, snackbar queue, and a loading
indicator. `useNotificationMessage()` from `@/capabilities/ui` translates known
catalog keys and displays explicit message strings as plain text. `ui.error()`,
`ui.action()`, and mutation failures use the same safe policy for exceptions: known
client error codes and known exception message keys are translated using the configured
locale fallback, server errors may show a trace reference, and other exceptions use a generic message.
Runtime exception details are not displayed or submitted to the missing-translation collector.

Loading is keyed and reference-counted. `start(key)` returns an idempotent release
function: completing one operation cannot hide another, including operations with
the same key. Prefer `await ui.loading.run('orders.save', () => save())` when no
additional cleanup is needed. It returns the action's result and releases loading
on success, rejection, or a synchronous throw.

For an operation that should report errors to the user rather than reject, use
`await ui.action('orders.save', () => save())`. It executes an application action with
named loading and automatic error notification. It preserves existing notifications
on start, returns `{ ok: true, data }` on success, and queues an error snackbar and returns
`{ ok: false, error }` on failure. The exported `UiActionResult<T>` type represents
these outcomes and preserves the original error as `unknown`. A successful action
may return `undefined` as its data; check `ok` rather than the data to detect success.
New notifications are appended rather than replacing earlier feedback. Call
`ui.clear()` explicitly if an initiating action should dismiss existing feedback.
Operations and their notifications may finish after a page is left.

```ts
const result = await ui.action('orders.save', () => save())
if (!result.ok) return
// Continue only after a successful save.
```

Callers that need no follow-up work can ignore the result. Use `ui.loading.run()`
instead when errors should propagate to the caller.

`loading.active.value` tracks all activity. `loading.has('auth.login')` tracks a
specific operation; `loading.has('auth')` also includes descendant keys such as
`auth.profile`. Application auth operations register their activity automatically.
Auth retains its private request guards and restoration deduplication; UI loading
does not control domain concurrency.

`loading.global.value` is the store-computed application loading indicator: tracked
activity is active and no local loading surface owns an overlay. The default layout
uses it for both the contained application overlay and the app-bar progress line.
Operation names do not require an `overlay.*` prefix. Auth activity without a local
loading owner uses the application fallback too.

Give each operation one local interaction owner:

- Forms use `:loading` to disable fields/actions and show one contained overlay.
  Table/view-generated forms own submission loading until their action completion
  callback is called. They do not need a parent `saving` ref or `loading` binding,
  and do not add their own overlay when the parent component covers the dialog.
- Tables retain their last successful rows and show a contained table overlay
  during fetches. Views use a contained overlay for external loading.
- While a table/view form dialog is open, its card owns the save overlay, covering
  fields and actions. The table/view background overlay is suppressed and the
  dialog cannot be dismissed during saving.
- The layout provides the store's `loading.registerOverlay()` callback through Vue
  context. Local loading surfaces register ownership with the store through that
  callback and suppress nested loading overlays through ancestor context. Registration
  is released when loading ends or a surface unmounts. Reusable components also work
  without the default layout and do not depend on the application store.
- On table save success, call `complete({ status: 'success', refetch: true })`.
  The table closes the dialog and explicitly reloads the current page, independently
  of external loading props and Vue render timing. Fetch loading is separate from
  submission loading. A refresh failure does not undo a successful save.
- On validation failure, call `complete({ status: 'invalid', errors })` to end
  submission and show field errors while preserving the draft.
- On other failures, call `complete({ status: 'error' })` to end submission and keep
  the dialog and draft open for retry. `ui.action()` reports the error; completion
  does not add another notification.
- View-generated forms use the same outcomes; the parent owns view data updates.
  Completion is single-use, and late completion after unmount has no effect.

Use the sandbox UI page to exercise preferences, persistent and timed page alerts,
queued severity messages, persistent snackbars, independent clearing, and a
two-second application loading demo.
