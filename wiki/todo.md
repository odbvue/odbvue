# OdbVue Modularity — Reasoning & Implementation Plan

> Status: proposal / design note. This document defines how OdbVue should
> approach modularity **without turning the framework into npm dependency-management
> hell**, and gives a concrete, phased plan grounded in the current codebase.

## 1. The problem

"Everything is a module" is a trap. If _module_ means "dozens of independently
versioned npm packages with arbitrary dependencies on each other", you get the
classic ecosystem nightmare:

```
odb-core     1.4
odb-web      2.8
odb-auth     4.1
odb-storage  0.9
odb-openai   3.7
```

Every combination becomes a compatibility matrix the user has to solve. Upgrades
stall. That is exactly what OdbVue must avoid.

The fix is to stop conflating **application-design modularity** with **package
distribution**. They are not the same thing.

## 2. The core distinction

OdbVue recognizes four different things people lazily call "modules", plus the
configuration that composes them:

| Concept         | Meaning                                      | Example                        | Distribution                       |
| --------------- | -------------------------------------------- | ------------------------------ | ---------------------------------- |
| **Package**     | Distribution mechanism (real npm boundary)   | `@odbvue/web`, `@odbvue/odb`   | npm package, one release train     |
| **Capability**  | Optional framework functionality             | `audit`, `settings`, `auth`    | built into a package, feature flag |
| **Integration** | Connection to an external technology/service | Google OAuth, OpenAI, S3, SMTP | built into a package, provider     |
| **Module**      | A business/application domain                | `customers`, `contracts`       | source folder in the app           |
| **Config**      | Declares which of the above are on, and how  | `odbvue.config.ts`             | one file in the app                |

Rule of thumb:

> **Packages are for framework architecture. Capabilities are optional framework
> functionality. Integrations are provider choices. Modules are business domains.
> Configuration composes them all.**

The target shape:

```
                    OdbVue (one version = one compatibility unit)
                       │
       ┌───────────────┼───────────────┐
       │               │               │
   Framework       Capabilities    Integrations
   packages         built-in         built-in
       │               │               │
       └───────────────┼───────────────┘
                       │
                  app config  (odbvue.config.ts)
                       │
                       ▼
                Business modules  (src/modules/*)
```

## 3. How this maps to OdbVue today

This is not greenfield theory — the current repo already leans this way:

- **Framework packages** already exist and are versioned together in one monorepo:
  [packages/odb](packages/odb) (`@odbvue/odb`),
  [packages/odb-oracledb](packages/odb-oracledb) (`@odbvue/odb-oracledb`),
  [cli](cli), [apps/web](apps/web). Compatibility is the _OdbVue_ version, not
  per-package semver drift.
- **Capabilities** already ship inside `@odbvue/odb` as built-in PL/SQL packages
  rather than separate installs: `odb_audit`, `odb_settings`, `odb_jwt`, `odb_lob`
  (see [packages/odb/src](packages/odb/src)). This is the "capability, not package"
  model working in practice on the DB side.
- **The web app** uses file-based routing over
  [apps/web/src/pages](apps/web/src/pages) via `unplugin-vue-router`, with route
  meta (`title`, `icon`, `visibility`, `access`, `roles`) driving the navigation
  store ([apps/web/src/stores/navigation.ts](apps/web/src/stores/navigation.ts)).
- **Per-feature i18n** is already auto-discovered per page folder by
  [apps/web/vite-plugin-i18n.ts](apps/web/vite-plugin-i18n.ts).
- **The generated ORDS/OpenAPI client** lives at
  [apps/web/src/services/openapi.generated.ts](apps/web/src/services/openapi.generated.ts),
  produced by the `ov` CLI.

What is **missing** is a first-class **module** boundary on the web side (business
domains are currently loose folders under `pages/`) and a single **application
capability declaration** (`odbvue.config.ts`). This document fills those gaps.

## 4. The four kinds of modularity, applied

### 4.1 Core framework packages — very few, independently meaningful

Keep the package count tiny and release them from one monorepo under one OdbVue
version:

```
@odbvue/odb          (DB compiler / model / ords / migrations)
@odbvue/odb-oracledb  (Oracle execution)
@odbvue/web           (Vue runtime + capabilities + integrations)
@odbvue/cli           (the `ov` tool)
```

Possibly later `@odbvue/testing`. That is the whole list. `OdbVue 1.6` — not
`odb-web 2.8 + odb-auth 4.1` — is the compatibility unit.

### 4.2 Capabilities — feature switches, not packages

Auth, audit, settings, storage, email, permissions are **configuration**, not
installs. They live inside `@odbvue/web` (and their DB halves inside `@odbvue/odb`,
which already ships `odb_audit`/`odb_settings`). Tree-shaking / compile-time
composition removes what an app doesn't enable.

```ts
// odbvue.config.ts
export default defineOdbVueApp({
  auth: { local: true, google: true, entra: false },
  audit: true,
  storage: { provider: 's3' },
  ai: { provider: 'openai' },
  email: { provider: 'smtp' },
})
```

A single capability flag fans out across every layer:

```
auth.google = true
      │
      ├─ web routes enabled       (login/callback)
      ├─ login button enabled     (navigation)
      ├─ callback endpoint enabled (ORDS)
      ├─ required DB objects enabled (migrations)
      └─ env validation enabled   (GOOGLE_CLIENT_ID present)
```

### 4.3 Integrations — provider choices

Google, Entra, OpenAI, OCI Object Storage, S3, SMTP are **providers** selected
under a capability. They are built-in source (compiled into `@odbvue/web`), not
separate packages. `storage: { provider: 's3' }` picks an implementation OdbVue
owns.

### 4.4 Business modules — source-level modularity in the app

Actual domains (`customers`, `contracts`, `claims`, `invoices`) are **folders,
not packages**. One `package.json`, one dependency tree, one release.

```
apps/web/src/modules/
  customers/
    module.ts          # defineModule(...) contract
    pages/             # file-based routes, prefixed by module
    components/
    stores/
    api/               # typed ORDS calls for this domain
    i18n/
  contracts/
    module.ts
    ...
```

Each module declares an explicit, shallow contract:

```ts
// src/modules/contracts/module.ts
export default defineModule({
  name: 'contracts',
  requires: ['customers'], // shallow, one-way dependency
  routes, // contributed to the router
  navigation, // contributed to navigation store
  permissions, // contributed to auth capability
})
```

### 4.5 Optional reusable packages — only when justified

Extract `@odbvue/auth`, `@odbvue/storage`, etc. **only after 2–3 apps genuinely
need them**, and even then version them on the same OdbVue release train
(`@odbvue/auth@2.3.0` alongside `@odbvue/web@2.3.0`). Resist premature extraction.

## 5. Why this over independent packages

Two framework models:

- **Scaffold-heavy** — `create-app` copies `auth.ts`, `google.ts`, `storage.ts`;
  users edit them; six months later OdbVue improves Google auth but can't update
  diverged user files → the classic starter-template dead end.
- **Runtime/framework** — user writes `auth({ google: true })`; the implementation
  lives inside OdbVue; `pnpm update @odbvue/*` delivers the improvement
  automatically.

OdbVue picks the second. Hence the guiding rule:

> **If OdbVue can express something declaratively, don't generate editable source
> for it.** Scaffolding is only for user-owned business code.

Prefer `auth({ google: true })` over `ov add google-auth` generating
`google-auth.ts` + `google-callback.ts` + `google-user-map.ts` (which become
technical debt the moment they're written). Reserve `ov generate module invoices`
for intentionally app-specific code.

## 6. Extension points (so config isn't a straitjacket)

Declarative config must not mean "OdbVue supports exactly these 7 things". Provide
typed hooks so ~80–90% is configuration and ~10–20% is escape hatches — without
forking the framework:

```ts
defineOdbVueApp({
  auth: {
    google: {
      enabled: true,
      mapUser(ctx) {
        /* app-specific behavior */
      },
    },
  },
  hooks: {
    'auth:user-created': async (ctx) => {
      /* ... */
    },
  },
})
```

## 7. Dependency rules

Dependency direction is enforced, one-way:

```
Framework  →  Capabilities  →  Application modules
```

- Business modules depend on **framework capabilities**, not on each other's
  internals.
- Cross-module contact goes through **contracts / events**, never deep imports:

  ```ts
  // avoid
  import { something } from '../customers/internal/service'
  // prefer
  const customers = useCapability('customers')
  // or
  events.emit('invoice.created', invoice)
  ```

- Module `requires` must stay **shallow**. Target:

  ```
  customers ─┐
  contracts ─┼──→ auth
  claims ────┼──→ audit
  billing ───┼──→ storage
  documents ─┘
  ```

  not `claims → contracts → customers → addresses → countries → settings`.

No enterprise event bus is required — simple typed contracts + a tiny typed
emitter are enough to hold the boundary.

## 8. Compile-time composition

Feature switches are **composition directives**, not just runtime booleans. The
Vite/plugin layer inspects the config and omits disabled capabilities/integrations
from the build:

```
OdbVue source distribution
        ↓
   app configuration (odbvue.config.ts)
        ↓
     composition (Vite plugin reads config)
        ↓
       build
        ↓
only selected capabilities/integrations
```

This reuses the pattern already present in
[apps/web/vite-plugin-openapi.ts](apps/web/vite-plugin-openapi.ts) and
[apps/web/vite-plugin-i18n.ts](apps/web/vite-plugin-i18n.ts): a config-driven Vite
plugin that generates/gates code at build time.

## 9. Target application shape

An OdbVue app stays boring:

```
my-app/
  odbvue.config.ts          # capability & integration declaration
  db/
    migrations/
    modules/                # DB-side business objects per module
  src/
    modules/
      customers/
      contracts/
      invoices/
    App.vue
```

The framework owns all generic behavior; the app owns business behavior.

## 10. Upgrade story

```
OdbVue 1.5  →  OdbVue 1.6
```

```
ov upgrade
  ├─ check framework version
  ├─ check config schema (codemods if needed)
  ├─ upgrade DB framework migrations
  ├─ regenerate ORDS/OpenAPI client
  ├─ validate capability compatibility
  └─ run tests
```

Because capabilities/integrations live inside OdbVue, `ov upgrade` rarely has to
rewrite application code. Business modules are the only user-owned surface, and
they talk to the framework through stable contracts.

## 11. Implementation plan

Phased, incremental, each phase shippable on its own. Nothing here forces a big-bang
rewrite; existing `src/pages` keeps working throughout.

### Phase 0 — Naming & docs (no code)

- [ ] Adopt the taxonomy (Package / Capability / Integration / Module / Config) in
      the wiki ([wiki/pages](wiki/pages)) so terminology is consistent.
- [ ] Record the "config before scaffolding" and "one release train" rules as
      framework principles.

### Phase 1.5 — Framework extraction (`apps/web` → `@odbvue/web`)

`defineOdbVueApp` and the module system both assume a framework package exists to
export them from. This phase extracts the generic, upgrade-owned parts of
[apps/web/src](apps/web/src) into `@odbvue/web`, leaving the app with business +
generated + brand code plus a thin `odbvue.config.ts` and `main.ts`.

**The dividing line:** `@odbvue/web` owns generic, reusable, upgrade-owned code
(components, composables, plugins, store logic, router/bootstrap factories, Vite
tooling). The app keeps business (`pages/`), generated (ORDS client), and brand
(theme/i18n) code.

| Current path                                                                                                                                                | Destination        | Move type                 | Notes                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/components](apps/web/src/components) (`VOv*` + `index.ts` types)                                                                                       | `@odbvue/web`      | **Full**                  | Pure framework UI. Ship via an auto-import/components **resolver** so the app keeps them ambient.                                                         |
| [src/composables](apps/web/src/composables) (`dnd`, `http`, `ui`)                                                                                           | `@odbvue/web`      | **Full**                  | Generic; `http.ts` is the framework fetch client.                                                                                                         |
| [src/plugins](apps/web/src/plugins) (`http`, `i18n`, `pinia-persist`, `vuetify`)                                                                            | `@odbvue/web`      | **Factory**               | Move factories; app passes config (locales, themes). Already the shape of `createHttpPlugin(options)`.                                                    |
| [src/stores/ui.ts](apps/web/src/stores/ui.ts), [navigation.ts](apps/web/src/stores/navigation.ts)                                                           | `@odbvue/web`      | **Full**                  | Alerts/loading + route-derived nav are framework.                                                                                                         |
| [src/stores/settings.ts](apps/web/src/stores/settings.ts)                                                                                                   | `@odbvue/web`      | **Full**                  | Theme/locale prefs; app can extend persisted keys.                                                                                                        |
| [src/stores/index.ts](apps/web/src/stores/index.ts) (`app` store)                                                                                           | `@odbvue/web`      | **Full, decouple**        | Today imports **root `package.json`** for `title`/`version` — must become injected config (`defineOdbVueApp({ title, version })`), not a relative import. |
| [src/router/index.ts](apps/web/src/router/index.ts)                                                                                                         | `@odbvue/web`      | **Factory**               | `createRouter` + `handleHotUpdate` + title guard is framework; routes are fed in from app scan + modules.                                                 |
| [src/App.vue](apps/web/src/App.vue)                                                                                                                         | `@odbvue/web`      | **Full**                  | The `import.meta.glob('./layouts/*.vue')` layout resolver becomes a framework root component.                                                             |
| [src/main.ts](apps/web/src/main.ts)                                                                                                                         | `@odbvue/web`      | **`createOdbVueApp()`**   | Bootstrap moves into the framework; app `main.ts` shrinks to `createOdbVueApp(config).mount('#app')`.                                                     |
| [src/layouts](apps/web/src/layouts)                                                                                                                         | `@odbvue/web`      | **Defaults, overridable** | Ship as defaults; app shadows by name.                                                                                                                    |
| [src/themes](apps/web/src/themes) (`defaults.ts`, `icons.ts`)                                                                                               | `@odbvue/web`      | **Defaults**              | `themes.json` (brand) **stays in app**.                                                                                                                   |
| Root [vite-plugin-openapi.ts](apps/web/vite-plugin-openapi.ts), [vite-plugin-i18n.ts](apps/web/vite-plugin-i18n.ts), and `@odbvue/web/vite` MDI icon plugin | `@odbvue/web/vite` | **Full**                  | Pure framework tooling under a `/vite` subpath export.                                                                                                    |
| Root [vite.config.ts](apps/web/vite.config.ts)                                                                                                              | app (thin)         | **Preset**                | App calls an `odbvue()` Vite preset that bundles the plugin stack.                                                                                        |

**Stays in the app (user-owned):** [src/pages](apps/web/src/pages) (except a
framework-default `[...path].vue` 404), [generated ORDS client](apps/web/src/services/openapi.generated.ts),
[src/i18n](apps/web/src/i18n) app messages (framework ships its own `odbvue.*`
namespace merged at runtime), `themes/themes.json`, `env.d.ts`, `index.html`,
`public/`, plus the new `odbvue.config.ts` and slimmed `main.ts`.

**The four mechanics that are the real work** (moving files is trivial by
comparison):

- [ ] **Subpath exports.** `@odbvue/web` (runtime: components, composables, stores,
      `createOdbVueApp`), `@odbvue/web/vite` (plugins + preset), `@odbvue/web/resolver`
      (auto-import).
- [ ] **Auto-import / components resolver.** Ship framework resolvers so ambient
      `VOv*` + composables keep resolving into the app's `components.d.ts` /
      `auto-imports.d.ts` without manual imports.
- [ ] **Dependency ownership.** Heavy libs (`vuetify`, `chart.js`, `leaflet`,
      `@tiptap/*`, `ofetch`, `pinia`, `vue-i18n`, `vue-router`, `@unhead/vue`) move to
      `@odbvue/web` as deps/peerDeps — peer-vs-bundled decided per lib (Vue/Vuetify →
      peer; leaflet/tiptap → lazy/optional).
- [ ] **Config injection replaces upward imports.** Anything reaching _up_ into the
      app (the `app` store reading root `package.json`, locale lists, theme names)
      flows _down_ through `defineOdbVueApp` config instead — this is what keeps
      upgrades non-breaking.

**Heavy-component tension.** `VOvMap` (leaflet), `VOvEditor` (tiptap), `VOvChart`
(chart.js), `VOvMedia`, `VOvShare` pull large optional deps. If they all live in the
root export, every app pays for them. Treat them as a **capability boundary** —
opt-in subpath exports or capability flags that gate the resolver — rather than
always-on (see the compile-time composition section).

### Phase 2 — Web module system

- [ ] Create `src/modules/` and a `defineModule()` contract
      (`name`, `requires`, `routes`, `navigation`, `permissions`, optional
      `setup(app)`).
- [ ] Add a module registry that auto-discovers `src/modules/*/module.ts` via
      `import.meta.glob`, does a topological sort on `requires`, and fails fast on
      cycles / missing deps.
- [ ] Extend routing: let module `pages/` fold into the existing file-based router
      (prefix routes by module name) so
      [apps/web/src/router/index.ts](apps/web/src/router/index.ts) merges module
      routes with `vue-router/auto-routes`.
- [ ] Feed module navigation into
      [apps/web/src/stores/navigation.ts](apps/web/src/stores/navigation.ts).

#### HMR & the module registry

The module system must **describe** the module graph, not **centralize** it.
HMR damage is not inherent to modules — it comes from funneling everything through
one eager hub that Vite then invalidates wholesale. Design rules:

- **Anti-pattern — the eager "god module".** Do **not** do
  `import.meta.glob('./*/module.ts', { eager: true })` and re-export every module's
  routes/components/stores from one `registry.ts`. That creates a hub with edges to
  everything; editing any module puts the hub in the invalidation set and forces a
  **full page reload**.
- **Lazy metadata registry.** Use `import.meta.glob('./*/module.ts')` **without**
  `eager: true`. The registry holds only lightweight metadata (`name`, `requires`,
  nav descriptors, permission strings) — never the heavy component/store graph.
- **Split the `defineModule` contract by weight.** Keep `module.ts` cheap; reference
  pages/components/stores by path or lazy import so editing a component invalidates
  only that leaf chunk.
- **Stay file-router-native for routes.** Fold module `pages/` into the
  `unplugin-vue-router` scan so `handleHotUpdate(router)` (already wired in
  [apps/web/src/router/index.ts](apps/web/src/router/index.ts)) keeps owning route
  HMR. Reserve imperative `defineModule({ routes })` for genuinely dynamic cases —
  imperative injection opts out of the plugin's route HMR and forces reloads.
- **Route contributed nav/state through Pinia with `acceptHMRUpdate`** (as
  [apps/web/src/stores/navigation.ts](apps/web/src/stores/navigation.ts) already
  does) so navigation hot-swaps instead of reloading.
- **Add `src/modules/\*/i18n/**` to the i18n plugin watch globs\*\* so module locales
  get the same per-scope HMR that pages already have.

Done this way, HMR granularity stays essentially unchanged from the current
per-page experience, because the module boundary lives in the folder layout and the
router scan (which Vite already HMRs well), not in a runtime singleton that touches
everything.

### Phase 3 — Capabilities as feature switches

- [ ] Turn `audit` and `settings` (already DB-native via `odb_audit` /
      `odb_settings`) into config-driven web capabilities: routes, stores, and UI
      register only when enabled.
- [ ] Add a compile-time gate in a Vite plugin that reads `odbvue.config.ts` and
      omits disabled capability/integration code from the bundle (mirror
      [apps/web/vite-plugin-openapi.ts](apps/web/vite-plugin-openapi.ts)).
- [ ] Define the `hooks` contract and a minimal typed event emitter for
      cross-module contracts (`events.emit` / `useCapability`).

### Phase 4 — Auth capability + first integrations

- [ ] Implement `auth` capability: `local` provider first (leans on existing
      `odb_jwt`), exposing routes, guards (`visibility`/`access`/`roles` already in
      the navigation model), and permissions.
- [ ] Add `google` / `entra` as **integrations** under `auth`, each with an
      `enabled` flag and a `mapUser(ctx)` extension point. Gate DB objects, ORDS
      endpoints, env validation, and UI on the flag.

### Phase 5 — CLI: `ov configure` / `ov generate module` / `ov upgrade`

- [ ] `ov configure` — interactive picker that **writes config**, not source
      (auth/storage/ai/email choices → `odbvue.config.ts`).
- [ ] `ov generate module <name>` — scaffold `src/modules/<name>/` (module.ts,
      pages, components, i18n) + optional `db/modules/<name>`.
- [ ] `ov upgrade` — version check, config-schema codemods, DB framework migration
      upgrade, ORDS/OpenAPI regen, compatibility validation, tests.
  - [ ] Add these under [packages/cli/src/commands](packages/cli/src/commands) +
        [packages/cli/src/app](packages/cli/src/app), matching the existing Commander structure.

### Phase 6 — Presets & polish

- [ ] Presets (`minimal` / `standard` / `enterprise`) with overrides:
      `preset('standard', { auth: { google: true }, storage: false })`.
- [ ] Document the compatibility matrix (which capabilities/integrations are tested
      together per OdbVue version) — the "curated distribution" model.

### Non-goals (for now)

- No extraction of `@odbvue/auth` / `@odbvue/storage` as separate packages until
  2–3 apps demand it.
- No per-capability independent semver.
- No enterprise event bus; typed contracts + a tiny emitter suffice.

## 12. Documentation roadmap

### Phase 2 — Rebuild the Web guide around OdbVue

- [ ] Review **Internationalization** from the same perspective: document configuration and application usage, not plugin installation.
- [ ] Review **Auto Imports** and move implementation/build details to Advanced where appropriate.
- [ ] Keep **Layouts**, but rewrite it around what application developers create/customize versus what OdbVue provides.
- [ ] Rename/rewrite **Consuming Web Services** around the intended `ORDS → OpenAPI → generated web client` workflow.

### Phase 3 — Separate capabilities from generic Web features

- [ ] Define documentation terminology for **framework**, **capability**, **integration**, **module**, and **application**.
- [ ] Create a **Capabilities Overview** page.
- [ ] Move Settings toward the capability documentation model.
- [ ] Prepare documentation slots for Auth, Audit, Storage, AI, and Email as their implementations mature.
- [ ] Keep purely visual/application-shell features such as layouts, navigation, feedback, and page-not-found under Web.
- [ ] Avoid creating capability pages before the corresponding framework API is stable.

### Phase 4 — Reclassify existing detailed content

- [ ] Audit every existing Web page with the question: "Does an OdbVue application developer need to do this?"
- [ ] Keep normal application-development instructions in Guide.
- [ ] Move framework implementation details to **Advanced / Under the Hood**.
- [ ] Remove obsolete setup instructions entirely when they only describe code now owned by `@odbvue/web`.
- [ ] Review Advanced UI Components individually; retain useful OdbVue component documentation without duplicating third-party library documentation.
- [ ] Review Default Layout, Navigation, Home Page, UI Feedback, Page Not Found, and Drag & Drop and place each under the correct new concept.

### Phase 5 — Add an Advanced section

- [ ] Add **Extending OdbVue**.
- [ ] Add **Web Runtime / Under the Hood** for developers who need to understand the Vue/Vuetify/runtime composition.
- [ ] Add **Hooks** when the hook contract is stable.
- [ ] Add **Integrations** when the integration contract is stable.
- [ ] Add **Modules** when the module contract is stable.
- [ ] Move Vite/plugin implementation details here instead of exposing them in normal setup documentation.

### Phase 6 — Introduce Reference documentation

- [ ] Add a **Reference** section separate from task-oriented guides.
- [ ] Create an `odbvue.config.ts` reference.
- [ ] Document each stable configuration property with type, default, purpose, and example.
- [ ] Add package references for `@odbvue/odb`, Oracle-specific APIs, and `@odbvue/web`.
- [ ] Add CLI command reference.
- [ ] Investigate generating configuration/API reference from TypeScript definitions to reduce documentation drift.

### Phase 7 — Fix onboarding and navigation

- [ ] Update the Getting Started flow so a new developer does not manually assemble Vue/Vuetify/plugins.
- [ ] Add **Project Structure** explaining what belongs in `apps/web`, `apps/db`, `odbvue.config.ts`, and application-owned source directories.
- [ ] Make the first practical tutorial modify an existing OdbVue application rather than construct Vue from scratch.
- [ ] Update the VitePress sidebar to match the new information architecture.
- [ ] Check and redirect/remove links to retired Web setup pages.
- [ ] Update README links and wording after the wiki structure stabilizes.

## 13. Open questions

- Where should module **DB objects** live and how do they register with migrations
  in [apps/db/src/migrations](apps/db/src/migrations)? (Likely a `db/modules/<name>`
  convention mirroring the web module.)
- Should module route prefixing be automatic (`/customers/...`) or declared in
  `defineModule`?
- How much of capability gating happens at **build time** (composition) vs
  **runtime** (guards)? Start runtime, add build-time stripping in Phase 3.
- Codemod tooling for `ov upgrade` config-schema migrations — build vs adopt.
