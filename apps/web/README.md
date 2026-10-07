# OdbVue web application

The complete Vue experience lives here, with no separate web runtime package.

## Source boundaries

- `src/main.ts`: bootstrap, startup error handling, and mount.
- `src/app`: main application shell, pages, layouts, composables, config access,
  auth, HTTP, errors, router, i18n, Pinia/persistence, UI, themes, and generated API types.
- `src/components`: shared `VOv*` components, compiled directly with the app.
- `src/modules/sandbox`: sandbox pages, translations, and diagnostics catalog.
- `plugins`: Node-only Vite plugins for routes/manifest, messages, icons, and OpenAPI.
- `test`: infrastructure and shared component suites; `src/__tests__`: app behavior;
  `e2e`: browser regression tests.

This retains release/v0's conventional Vue folders while distinguishing the main
application from self-contained modules. Modules may add their own components,
composables, stores, and API calls. Infrastructure must not import sandbox.

`src/app/plugins` explicitly installs the Vue libraries and provides typed,
application-scoped services. There is no dynamic capability registry or contract
system. Use focused composables, not an aggregator store. Pinia supplies UI and
preferences; authentication already owns reactive state and needs no wrapper.

Main pages generate `/...` routes from `src/app/pages`; module pages generate
`/<module>/...` routes from `src/modules/<module>/pages`. Only page folders are
scanned. Restart Vite after adding a new module's pages folder; existing page
changes use route HMR. Modules share the same auth/navigation metadata rules.

## Authentication

The [login page](./src/app/pages/login.vue) supports username/password authentication
(no Google login). Pages and the [default layout](./src/app/layouts/DefaultLayout.vue)
use `useAuth()` directly. Config supplies title/version, while preferences and UI
use their own APIs.

No auth state is persisted in localStorage or sessionStorage. Application setup restores the session
once at startup with `POST /auth/refresh`, then `GET /auth/me`. The [entry point](./src/main.ts)
waits for service readiness and router readiness before mounting. Guards await the same
startup promise instead of issuing another refresh. Access tokens and user details remain in
memory; the server-managed refresh cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`. Existing
preference persistence is unchanged.

The default layout shows login/logout controls and the current identity. Application guards
enforce page `access` metadata; `with-role` requires any listed role and every listed permission.
Unauthenticated visitors to protected pages return there after login, while authenticated users
without access are sent home with an error. Login redirects must resolve to a local route.
`installAppRouting()` in the [router](./src/app/router/index.ts) installs those guards and title
updates. Application destinations can be configured with `auth.routes.login`,
`auth.routes.authenticated`, and `auth.routes.forbidden`. Navigation applies the same access
policy (including parents) and additionally checks `visibility`. These client-side checks complement,
not replace, authorization on the API.

All sandbox module pages require the `admin` role for both access and navigation visibility.

Notifications translate existing catalog keys and display other messages as plain text.
Runtime errors are not sent to the missing-translation collector.

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

```sh
pnpm test:unit
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
