# apps

This template should help get you started developing with Vue 3 in Vite.

## Authentication

The [login page](./src/pages/login.vue) supports username/password authentication (no Google
login). The [main store](./src/stores/index.ts) exposes the runtime title, version, preferences,
UI feedback, and the [auth store](./src/stores/auth.ts). The auth store wraps the same `useAuth()`
capability used by the sandbox; it does not create a separate session.

No auth state is persisted in localStorage or sessionStorage. The runtime restores the session
once at startup with `POST /auth/refresh`, then `GET /auth/me`. Stores and route guards wait for
that restoration instead of issuing another refresh. Access tokens and user details remain in
memory; the server-managed refresh cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`. Existing
preference persistence is unchanged.

The default layout shows login/logout controls and the current identity. Application guards
enforce page `access` metadata; `with-role` requires any listed role and every listed permission.
Unauthenticated visitors to protected pages return there after login, while authenticated users
without access are sent home with an error. Login redirects must resolve to a local route.
Navigation uses the same policy for `visibility` metadata. These client-side checks complement,
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
