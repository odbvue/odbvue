# Table

## Overview

`VOvTable` renders a paged data table with search, filtering, sorting, row actions, table actions, and mobile-friendly item rendering. It delegates fetching to the parent through the `fetch` event and exposes its own `fetch()` helper for imperative reloads.

## Dependencies

- `vue`
- `vuetify`
- `vue-i18n`

## Usage

```vue
<template>
  <v-ov-table
    :options="options"
    :items="items"
    :loading="loading"
    :next-cursor="nextCursor"
    @fetch="fetch"
    @action="action"
  />
</template>

<script setup lang="ts">
import type { OvTableOptions } from '@/components'

const options = ref<OvTableOptions>({
  key: 'name',
  columns: [{ name: 'name' }, { name: 'status' }],
})
</script>
```

## API

### Props

| Prop          | Type             | Default     | Description                                               |
| ------------- | ---------------- | ----------- | --------------------------------------------------------- |
| `options`     | `OvTableOptions` | required    | Table layout, columns, search, filter, sort, and actions. |
| `items`       | `OvTableData[]`  | `[]`        | Current page of rows supplied by the parent.              |
| `nextCursor`  | `string`         | `undefined` | Cursor for the next page.                                 |
| `loading`     | `boolean`        | `false`     | Shows the loading overlay.                                |
| `title`       | `string`         | -           | Optional title above the table.                           |
| `description` | `string`         | -           | Optional description above the table.                     |
| `stateKey`    | `string`         | -           | Persists table state to `sessionStorage` under this key.  |

### Emits

| Event    | Payload                                              | Description                                |
| -------- | ---------------------------------------------------- | ------------------------------------------ |
| `fetch`  | `(data, cursor, limit, search?, filter?, sort?, complete?)` | Requests a page; call `complete(success)` after fetching. |
| `action` | `(name, data, value?, callback?)`                    | Emitted for table, row, and cell actions.  |

### Exposed

| Method    | Type                  | Description                                    |
| --------- | --------------------- | ---------------------------------------------- |
| `fetch()` | `(action?: 'first' \| 'next' \| 'prev') => Promise<boolean>` | Resolves true only when the requested page succeeds. |

### Slots

| Slot          | Scope      | Description                                  |
| ------------- | ---------- | -------------------------------------------- |
| `title`       | -          | Replaces the title block.                    |
| `description` | -          | Replaces the description block.              |
| `expand`      | `{ item }` | Adds an expandable detail row for each item. |

### Table Options

`options` is an `OvTableOptions` object with these main parts:

- `key`: row identity field.
- `columns`: array of `{ name, label, format, actions, actionFormat, maxLength, align }`.
- `search`: optional search label, placeholder, and default value.
- `filter`: optional `OvFormOptions` used for the filter dialog.
- `sort`: optional sort descriptors with `name`, `label`, and `value`.
- `actions`: table-level actions, including grouped actions.
- `itemsPerPage` / `mobileItemsPerPage`: pagination sizes.
- `canRefresh`: enables the refresh button.
- `alwaysMobile`: forces mobile layout.

### Notes

- Search, filter, sort, and page state can be persisted with `stateKey`.
- On mobile, the table switches to a stacked layout and uses `mobileItemsPerPage` when provided.
- Column and action formatting use `OvFieldFormat` and `OvActionFormat` under the hood.
- Row expansion only appears when the `expand` slot is provided.
- Enable remote sorting only when the fetch handler and endpoint implement the requested ordering.
  name: 'add',
  format: { icon: '$mdiPlus', text: 'Add' },
    form: {
      fields: [
        { type: 'text', name: 'name', label: 'Name' }
      ],
      actions: [{ name: 'add' }, { name: 'cancel' }],
      actionSubmit: 'add',
      actionCancel: 'cancel'
    }
  },
  {
    name: 'export',
    format: { icon: '$mdiDownload', text: 'Export' }
  },
  {
  name: 'bulk-status',
  format: { icon: '$mdiListStatus', text: 'Change Status' },
  form: {
  fields: [
  {
  type: 'select',
  name: 'status',
  label: 'New Status',
  items: ['active', 'blocked'],
  required: true
  }
  ],
  actions: [{ name: 'bulk-status' }, { name: 'cancel' }],
  actionSubmit: 'bulk-status',
  actionCancel: 'cancel'
  }
  }
  ]

````

### Pagination

Tables are paginated with configurable items per page:

```typescript
{
  itemsPerPage: 10     // Items to display per page
}
````

Navigation buttons appear in the table footer:

- **Previous** - Disabled on the first page or while loading
- **Next** - Disabled without a server continuation cursor or while loading
- **Refresh** - Appears when `canRefresh: true`

The fetch handler must call the supplied completion callback exactly once:
`complete?.(await query.load({ cursor, limit, search }))` when using
`useCursorQuery()`. Vue event emission does not await the handler's promise.
Publish rows and `nextCursor` before reporting success; report false on failure
and display the error through the normal application feedback mechanism.

Cursor history changes only after success. Keep the last successful rows and
continuation on failure so Next/Previous can retry the same request. Navigation
and refresh are blocked while fetching; a first-page request (search, filter,
sort or responsive page-size change) can supersede a pending request. Fetch
handlers must ignore superseded responses, as `useCursorQuery()` does.
Changed query parameters reset pagination, including retries after a failed
search, rather than reusing a cursor from the previous query.

### Data Format

Table data is an array of objects where object keys match column `name` properties:

```typescript
type OvTableData = Record<string, unknown>

const data: OvTableData[] = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1-555-0123',
    status: 'active',
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1-555-0456',
    status: 'inactive',
  },
]
```

### Responsive Behavior

**Desktop Layout:**

- Standard HTML table display
- All columns visible horizontally (scrollable)
- Header row with column titles
- Search, filter, sort controls in secondary header rows

**Mobile Layout (automatic):**

- Card-style display (one row per item)
- Column name as left column, value as right column
- Stacked layout for easier viewing on small screens
- All features (search, filter, sort) remain accessible

### Cell Value Truncation

Long cell values can be truncated with a detail view button:

```typescript
{
  name: 'description',
  maxLength: 100    // Show max 100 chars, add detail button
}
```

When user clicks the "..." detail button, a modal opens showing the full value in a textarea.

Special handling:

- `maxLength: 0` - Always show detail button with full content
- `maxLength` not set - Use table-level `maxLength` (default: 32767, i.e., no truncation)

### Format Rules

Cells can apply conditional formatting using validation rules (see [Form documentation](./form.md#validation-rules) for available rule types):

```typescript
format: [
  {
    rules: { type: 'greater-than', params: 100 },
    color: 'success',
    text: 'High',
  },
  {
    rules: { type: 'less-than', params: 10 },
    color: 'error',
    text: 'Low',
  },
  { color: 'warning' }, // Default fallback
]
```

### Action Handling

**Row Actions:**
Events with actionName, full data array, and the specific row data.

```typescript
@action="(name, data, row) => {
  if (name === 'edit') {
    // Edit row - form data submitted in event
  } else if (name === 'delete') {
    // Delete row
  }
}"
```

**Table Actions:**
Events with actionName, full data array, and form submission data.

```typescript
@action="(name, data, formData) => {
  if (name === 'add') {
    // Add new row - formData contains new row data
  } else if (name === 'bulk-status') {
    // Bulk operation - formData contains operation parameters
  }
}"
```

**Action Key:**
Use the `key` property to extract a specific field value for the action:

```typescript
{
  name: 'delete',
  key: 'id',              // Pass item.id instead of entire item
  format: { icon: '$mdiDelete' }
}
```

## Styling

The table uses Vuetify defaults provider for consistent styling.

## Fetch Event Details

The `fetch` event provides all necessary parameters for server-side data handling:

| Parameter | Type            | Example                                                     |
| --------- | --------------- | ----------------------------------------------------------- |
| `data`    | `OvTableData[]` | Current page data                                           |
| `offset`  | `number`        | `0` for first page, `10` for second (with itemsPerPage: 10) |
| `limit`   | `number`        | `11` (itemsPerPage + 1 to detect more pages)                |
| `search`  | `string`        | `"search term"` or `""`                                     |
| `filter`  | `OvFilterValue` | `{ status: ['active', 'blocked'], phone: ['5551234'] }`     |
| `sort`    | `string`        | `"name,status-desc"` or `""`                                |

### Filter Object Format

Filters are passed as an object where each key is a field name and the value is always an array of strings:

```typescript
type OvFilterValue = Record<string, string[]>

// Examples:
{ status: ['active'] }
{ status: ['active', 'blocked'], phone: ['5551234'] }
{ email: ['user@example.com'] }
```

**Note:** Filter values are always arrays, even when filtering by a single value. This provides consistent handling across the API.

### Sort String Format

Sort order respected with optional `-` prefix for descending:

```
name,status            // name asc, then status asc
name,-status           // name asc, then status desc
-name,status,-id       // Combined ascending and descending
```

## Notes

- Column widths are automatically calculated; use CSS classes for custom sizing
- Search is case-insensitive full-text search across all columns
- Filter values are case-insensitive partial matches by default
- Sort preserves the order of columns in the sort array (first sort is primary)
- Mobile layout automatically activates below Vuetify's `md` breakpoint
- Actions on cells show in the cell content area; table actions appear in footer
- Detail view modal appears for truncated cells and opens readonly textarea
- Filter state persists until cleared; sort state is shown as chips
- Refresh button only appears when `canRefresh: true` and data is loaded
- All labels, placeholders, and action text respect the `t` translation function
- Loading overlay prevents interaction during data fetch operations
- The `fetch` method can be called manually via template ref to refresh data

## Composables

### useTableFetch

Encapsulates server-side data fetching for tables with search, filtering, and sorting.

```typescript
const {
  loading,
  data,
  fetch: fetchSettings,
} = useTableFetch({
  endpoint: 'adm/settings/',
  responseKey: 'settings',
})
```

**Options:**

- `endpoint` (string, required): API endpoint for fetching data
- `responseKey` (string, required): Key in response containing data array
- `filter` (OvFilterValue, optional): Pre-applied filters
- `search` (string, optional): Pre-applied search term

**Returns:** `{ loading, data, fetch }`

### useFormAction

Handles form-based actions with automatic error handling and loading state.

```typescript
const { action: actionSettings } = useFormAction({
  endpoint: 'adm/setting/',
})
```

**Options:**

- `endpoint` (string, required): API endpoint for the action

**Returns:** `{ loading, action }`

The action function accepts: `(name, item, value?, callback?)` where callback receives errors if present.

**Multiple Actions:**

```typescript
const { action: actionSettings } = useFormAction({ endpoint: 'adm/setting/' })
const { action: actionUsers } = useFormAction({ endpoint: 'adm/user/' })
```
