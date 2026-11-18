# OdbVue review checklist

When changing or reviewing a database-backed list or a Vue page, re-check the applicable items below.

- Use server-side cursor paging for database-backed tables. Order by a stable unique key and use the typed query's `.paginate({ cursor: after, limit })`. Pass `cursor`, `limit`, and any `search` to the API. Forward `{ items, nextCursor }` unchanged; send `nextCursor` back as the next request's opaque `cursor`. Do not parse it or slice rows in the browser.
- Filter in the database before paginating. For large catalogs, use paged search in pickers instead of preloading the full catalog.
- Let `v-ov-table` default to five rows per page on desktop and one on mobile. Override page sizes only when the page explicitly needs different behavior.
- Translate route titles, breadcrumbs, navigation labels, page titles, table headers, search placeholders, and action labels in English, German, and French. Keep shared keys in the module locale files; check the merged messages for placeholders that override real translations.
- Use `v-ov-table` options for table and row actions. Give icon-only actions a translated tooltip and accessible name. Skip redundant table headings when the surrounding tab already provides context.
- Keep route pages responsible for route state, breadcrumbs, and shared data loading. Extract substantial tab content into components; pass shared data as props and emit updates back to the route.
- For one-at-a-time role assignment, close the picker before refreshing the assigned table. Show feedback on the page, refresh only after success, and avoid loading overlays on the background table while the picker is open. Do not return or refetch the full catalog after a write; use a bounded response such as `204 No Content` when the UI only needs confirmation.
- Enforce admin-only access and self-action restrictions in the API, not just in the UI. Use the authenticated actor from server context and confirm destructive actions in the UI.
- After changing a service contract, regenerate the web OpenAPI types. Before finishing, run focused regression tests for the changed behavior and report what was verified or could not be checked.
