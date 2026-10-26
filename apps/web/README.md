# OdbVue web application

The complete Vue experience lives here, with no separate web runtime package.

## Source boundaries

- `src/main.ts`: bootstrap, startup error handling, and mount.
- `src/api`: generated backend contract types from OpenAPI; never edit them manually.
- `src/app`: application shell, pages, layouts, router assembly, and locale messages.
- `src/capabilities`: shared auth, HTTP, errors, network status, routing APIs,
  i18n initialization, Pinia/persistence, UI helpers/themes, drag-and-drop,
  configuration access, and runtime wiring.
- `src/components`: shared `VOv*` components, compiled directly with the app.
- `src/modules/sandbox`: sandbox pages, translations, and diagnostics catalog.
- `plugins`: Node-only Vite plugins for routes/manifest, messages, icons, and OpenAPI.
- `test`: all Vitest suites, organized by source boundary; `e2e`: browser regression tests.

Application pages and modules consume public capability entry points such as
`@/capabilities/auth`, `@/capabilities/http`, and `@/capabilities/routing`.
Capabilities must not import the application shell, pages, layouts, or modules.
Modules may add their own components, composables, stores, and API calls.
Keep shared helpers with their owning capability rather than in generic
`composables` or `services` folders.

`src/app/router.ts` assembles generated routes and connects shared routing guards
and metadata handling. `src/capabilities/i18n` initializes localization, while
application messages live in `src/app/i18n` and module/page messages remain
in their own `i18n` folders.

`src/main.ts` explicitly installs Pinia, Vue I18n, Vuetify, and the router, then mounts
the application immediately. Infrastructure exports application-scoped ES module
instances; focused composables use these directly, without a service container,
installer, event bus, or generic readiness lifecycle. Factories remain for isolated
tests and dedicated HTTP clients. Pinia supplies UI and preferences with a
persistence plugin. `createState()` creates isolated Pinia instances for tests;
the application uses the shared `pinia` instance.
Sandbox state diagnostics read Pinia's public reactive state directly, without
a separate store registry.

Auth and HTTP factories live in [auth/core.ts](./src/capabilities/auth/core.ts) and
[http/core.ts](./src/capabilities/http/core.ts), independently of application configuration
and singleton initialization. [client.ts](./src/capabilities/client.ts) wires the shared
instances together through deferred client and token callbacks, without circular
module imports. The public auth and HTTP entry points retain the factories,
singletons, types, and `useAuth()` / `useHttp()` APIs.

Main pages generate `/...` routes from `src/app/pages`; module pages generate
`/<module>/...` routes from `src/modules/<module>/pages`. Only page folders are
scanned. Restart Vite after adding a new module's pages folder; existing page
changes use route HMR. Modules share the same auth/navigation metadata rules.

## Authentication

The [login page](./src/app/pages/login.vue) supports username/password authentication.
Login and signup also offer Google sign-in when shared `GET /auth/config`
capabilities contain `google: true`. Configuration failures surface through
the normal restoration error flow; components make no separate config request.
The shared Google button sanitizes the local return destination, then calls
`auth.google.login({ redirect })` (`POST /auth/google/start`, credentials included).
Only the returned HTTPS `accounts.google.com/o/oauth2/v2/auth` URL can be opened.
The backend owns OIDC authorization-code exchange and the HttpOnly transaction cookie;
the web app never constructs OAuth requests, loads Google scripts, or stores Google tokens.
After the backend callback, the existing auth guard restores the refresh-cookie session
and applies the local redirect. Anonymous callback failures on `/login?google=cancelled`,
`failed`, or `conflict` show fixed localized feedback and remove the consumed query flag
without dropping the return destination. No frontend Google client ID is needed.
An existing-email conflict never automatically links accounts: sign in using the existing
method, then the guided redirect opens Settings > Account with the original destination
preserved. Choose **Connect Google**, or **Continue without connecting** to skip it.
The authenticated `/settings/account` page offers connecting only when Google
is enabled, a local password exists, and Google is not already connected.
It requires the current password. `auth.google.link({ redirect, password })`
calls authenticated `POST /auth/google/link/start` with credentials included, using
a validated local destination (or `/settings/account` for a connection started directly from settings).
Only the validated Google authorization URL is opened. Password confirmation failures do
not trigger automatic session refresh, and starting a link never changes local auth state.
The backend uses `AUTH_GOOGLE_REDIRECT_URI` and `/auth/google/callback` for both
sign-in and linking. Register that one URI in Google OAuth settings. The consumed,
browser-bound server transaction determines the purpose; the browser cannot select it.
Configuration failures show dedicated guidance instead of a generic linking error.
The backend callback returns `/settings/account?google=linked`, `cancelled`, or `error`,
with an encoded `redirect` destination;
identity conflicts use the generic error outcome. The page also recognizes `conflict`
defensively, consumes the outcome once, and displays fixed localized feedback. Linking never
logs in another user, merges accounts, or replaces the app refresh cookie.
After successful linking the page continues to the validated destination; cancellation
and failure keep it for retry. Linking uses fresh Google authorization, not a cached
token from the earlier collision. Accounts and login credentials are separate:
password and Google identities belong to the same stable application user ID.
Pages and the [default layout](./src/app/layouts/DefaultLayout.vue)
use `useAuth()` directly. Config supplies title/version, while preferences and UI
use their own APIs.

No auth state is persisted in localStorage or sessionStorage. The first router guard restores the session
with `POST /auth/refresh` alongside anonymous `GET /auth/config`, then authenticated
`GET /auth/me` when refresh succeeds. Configuration is the flat boolean object
`{ password, ldap, google, signup, twoFactor }`, exposed through the readonly
`auth.config` ref (null until loaded) and retained across logout.
`auth.refreshUser()` reloads the direct user response from `/auth/me`.
Two-factor challenges use `auth.twoFactor.verify()`. Recovery and reset use
`auth.password.recover()` and `auth.password.reset()` with `POST /auth/password/recover`
and `POST /auth/password/reset`. Signup confirmation uses `auth.confirmSignup()` with
`POST /auth/signup/confirm`. Browser routes such as `/confirm-email` and
`/reset-password` are unchanged; no legacy auth API aliases are exposed.
The [entry point](./src/main.ts)
mounts the shell while initial navigation is pending. Auth restoration is lazy and idempotent:
concurrent guards and later navigations share the same promise instead of issuing another refresh.
Overlapping `auth.refresh()` calls also share one in-flight request; later calls can refresh again.
Auth operation observation feeds loading indicators only, not a global concurrency lock.
Google linking separately rejects overlapping link starts.
The reactive auth `ready` flag remains available to login controls; it is not a bootstrap lifecycle.
Access tokens and user details remain in
memory; the server-managed refresh cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`. Existing
preference persistence is unchanged.

The default layout shows an accessible name/avatar menu containing Settings and Logout.
Logout clears cached restoration failures and opens the configured login route
(`auth.routes.login`, default `/login`), including when server-side revocation fails.
Logout and navigation failures are reported through UI feedback.
The drawer shows a static identity summary above separate Settings and Logout entries.
Settings (`/settings`) opens Account (`/settings/account`) by default. Account is currently
the only settings section; future sections will use `/settings/appearance`,
`/settings/language`, and `/settings/notifications` when implemented. Legacy `/account`
links redirect to Account while retaining query parameters and the URL hash, including
Google callbacks from existing database deployments.
The Account page shows the name/email once and actual password/Google connection status from
`GET /auth/me`; missing provider metadata is shown as unavailable, never inferred.
Google-only accounts are directed to Google to manage their password.

Users can upload JPEG/PNG/WebP files up to 5 MB. The browser crops and re-encodes a
128 x 128 JPEG thumbnail (maximum 30,000 data-URL characters), stripping original metadata.
`auth.profile.updateAvatar()` uses authenticated `PUT /auth/me/avatar` to decode the thumbnail into an owner-scoped Storage BLOB;
the user record holds only its storage key. `{ avatar: null }` removes it, and replacing
or removing an upload deletes its previous object atomically.
`GET /auth/me` returns `avatarId` and the Google `avatarUrl` directly; uploaded thumbnails are
fetched through authenticated `GET /auth/avatar/:id` and shown using temporary blob URLs.
Downloads are private/no-store, and blob URLs are revoked on replacement or sign-out.
Both profile and navigation update immediately. Uploaded photos take precedence over
Google photos captured from verified Google sign-in tokens; initials are the final fallback.
Google photos are restricted to HTTPS `lh<N>.googleusercontent.com` URLs, loaded without
a Referer header, and refreshed on Google sign-in. No extra Google API request/scope is needed.
Broken or unavailable remote images fall back to initials.

`auth.password.change()` uses authenticated `POST /auth/password/change` and requires the current password, a new password
of 8-256 characters, and matching confirmation. A successful change revokes every session
and access-token version, removes outstanding recovery tokens, expires the refresh cookie,
clears in-memory identity, and returns to Login with confirmation. Password verification
failures do not refresh or clear the current session. Password fields are cleared after
each submitted request. Profile columns, runtime procedures and services are included
in the bootstrap migration. Rebuild and redeploy the database before deploying the new
web app; no separate incremental profile migration is supplied.

Application guards
enforce required page `access` metadata: `public`, `authenticated`, `anonymous`, or a non-empty
role array such as `['admin', 'editor']`. Role arrays require authentication and any listed role.
Optional `permissions` require every listed permission and are supported only with
`authenticated` access or a role array when non-empty.
Unauthenticated visitors to protected pages return there after login, while authenticated users
without access are sent home with an error. Login redirects must resolve to a local route.
The [router](./src/app/router.ts) registers the manifest, auth guard, and successful-navigation
title updates directly. Titles use `document.title` without a head manager.
Application destinations can be configured with `auth.routes.login`,
`auth.routes.authenticated`, and `auth.routes.forbidden`. Navigation applies the same access
policy (including parents); `navigation: false` excludes a page from menus and breadcrumbs
without denying route access. Every page must declare a boolean `navigation`; display uses page
`icon` and `order`. Vue and Markdown metadata is validated when the completed route manifest is created.
Generated structural routes do not need page metadata.
These client-side checks complement,
not replace, authorization on the API.

All sandbox module pages declare `access: ['admin']` and `navigation: true`.

Notifications translate existing catalog keys and display other messages as plain text.
Runtime errors are not sent to the missing-translation collector.
Vue, router, and HTTP errors are captured by the error service. Capturing a framework
error does not automatically display a notification; user-facing flows explicitly
choose their feedback.

Use HTTPS in production and a compatible API origin so the browser can send the refresh cookie.
If developing through Vite's `/api` proxy, verify that the browser accepts the secure cookie
on your development origin; without that cookie, login works only until the page is reloaded.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

All Vitest tests live under `test` and use the `.test.ts` suffix. Mirror meaningful
source boundaries: `test/app`, `test/capabilities`, `test/components`, and
`test/modules/<module>`.
Bootstrap tests live at `test/main.test.ts`; Node-only Vite plugin tests live
under `test/plugins`. Name tests after the subject they exercise, for example
`test/app/pages/login.test.ts` for the login page.

Shared setup, stubs, and fixtures belong in `test/support`. Prefer `@/` imports
for application source so moving tests does not break source imports. The `app`
Vitest project runs application, capability, module, bootstrap, and plugin tests; the
`components` project runs shared component tests with its own Vuetify setup.
Both projects discover nested `.test.ts` files recursively. Playwright tests
remain separate in `e2e` and use `.spec.ts`.

```sh
pnpm test:unit
# Run all Vitest suites once
pnpm test:run
# Run one project
pnpm test:run --project=components
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
pnpm build

# Runs the end-to-end tests
pnpm test:e2e
# Runs the tests only on Chromium
pnpm test:e2e --project=chromium
# Runs the tests of a specific file
pnpm test:e2e tests/example.spec.ts
# Runs the tests in debug mode
pnpm test:e2e --debug
```
