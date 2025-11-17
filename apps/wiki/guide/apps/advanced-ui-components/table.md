# Table

Powerful data table component with integrated search, filtering, sorting, pagination, and row/table-level actions. Supports responsive mobile layout, custom cell formatting, and inline editing with modal forms.

## Overview

`VOvTable` provides a comprehensive data display solution with configurable columns, built-in search and filtering capabilities, multi-column sorting, and action handling. Supports dynamic cell formatting with conditional styling, inline forms for editing, and both mobile-friendly card layout and desktop table view. The component handles large datasets with pagination and includes refresh functionality.

**Features:**
- Configurable columns with custom formatting and alignment
- Full-text search across all columns
- Advanced filtering with form-based interface
- Multi-column sorting with drag-to-reorder
- Pagination with next/previous navigation
- Row-level actions with inline editing via modal forms
- Table-level actions (add, bulk operations)
- Cell-level actions with confirmation forms
- Responsive mobile layout (card view)
- Custom cell rendering with truncation and detail view
- Loading state with overlay indicator
- Conditional cell formatting with validation rules
- Full TypeScript support

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-table.vue 
:::

## API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `OvTableOptions` | - | **Required.** Table configuration with columns, actions, and features |
| `data` | `OvTableData[]` | `[]` | Array of data objects to display in table rows |
| `loading` | `boolean` | `false` | Show loading overlay with spinner |
| `t` | `(text?: string) => string` | `(text) => text` | Translation/localization function for labels and messages |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `fetch` | `data: OvTableData[], offset: number, limit: number, search?: string, filter?: string, sort?: string` | Emitted when data needs to be fetched (on mount, page change, search, filter, sort) |
| `action` | `name: string, data: OvTableData[], value?: OvTableData` | Emitted when row action, table action, or cell action is triggered |

### Exposed Methods

| Method | Parameters | Description |
|--------|-----------|-------------|
| `fetch` | `newPage?: number` | Manually trigger data fetch for current or specified page |

### Table Options

```typescript
interface OvTableOptions {
  // Required
  key: string
  columns: OvTableColumn[]

  // Optional - Display
  columnFormat?: OvFormat | OvFormat[]
  maxLength?: number
  align?: 'left' | 'center' | 'right'
  itemsPerPage?: number
  currentPage?: number

  // Optional - Search
  search?: {
    value?: string
    label?: string
    placeholder?: string
  }

  // Optional - Filtering
  filter?: OvFormOptions

  // Optional - Sorting
  sort?: OvTableSort[]

  // Optional - Actions
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]

  // Optional - Behavior
  canRefresh?: boolean
}
```

### Column Definition

Columns define how data is displayed and edited:

```typescript
interface OvTableColumn {
  // Required
  name: string

  // Optional - Display
  title?: string
  align?: 'left' | 'center' | 'right'
  maxLength?: number

  // Optional - Formatting
  format?: OvFormat | OvFormat[]

  // Optional - Actions
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
}
```

#### Column Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | **Required.** Unique column identifier matching data object keys |
| `title` | `string` | Column header text (uses `name` if not provided) |
| `align` | `'left' \| 'center' \| 'right'` | Text alignment (default: left) |
| `maxLength` | `number` | Character limit for display (0 = full content with detail button) |
| `format` | `OvFormat \| OvFormat[]` | Conditional formatting rules for cell styling |
| `actions` | `OvAction[]` | Array of actions available on each cell/row |
| `actionFormat` | `OvFormat \| OvFormat[]` | Default formatting for actions in this column |

#### Column Formatting

Cells can be formatted based on their values using validation rules:

```typescript
{
  name: 'status',
  title: 'Status',
  align: 'center',
  format: [
    {
      rules: { type: 'starts-with', params: 'active' },
      color: 'green',
      text: 'Active'
    },
    {
      rules: { type: 'starts-with', params: 'inactive' },
      color: 'orange',
      text: 'Inactive'
    },
    { color: 'red', text: 'Blocked' }
  ]
}
```

#### Column Actions

Actions on columns enable row-level operations:

```typescript
{
  name: 'actions',
  title: 'Actions',
  align: 'right',
  actions: [
    {
      name: 'edit',
      format: { icon: '$mdiPencil' },
      form: {
        fields: [
          { type: 'text', name: 'name', label: 'Name' },
          { type: 'email', name: 'email', label: 'Email' }
        ],
        actions: ['edit', 'cancel'],
        actionSubmit: 'edit',
        actionCancel: 'cancel'
      }
    },
    {
      name: 'delete',
      format: { icon: '$mdiDelete', color: 'red' }
    }
  ]
}
```

### Sort Configuration

Multi-column sorting with reorderable sort priorities:

```typescript
interface OvTableSort {
  name: string
  label?: string
  value?: 'asc' | 'desc'
}
```

**Sort Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | **Required.** Column name to sort by |
| `label` | `string` | Sort label (uses `name` if not provided) |
| `value` | `'asc' \| 'desc'` | Sort direction (undefined = not sorted) |

Example:

```typescript
sort: [
  { name: 'name', value: 'asc' },     // Sort by name ascending
  { name: 'email' },                  // Available to sort
  { name: 'status', value: 'desc' }   // Sort by status descending
]
```

### Search Configuration

Full-text search across all columns:

```typescript
search: {
  value: 'initial search term',
  label: 'search.label',              // Translation key or text
  placeholder: 'search.placeholder'
}
```

When a user enters search text and presses Enter or clicks the search button, the `fetch` event is emitted with the search query.

### Filter Configuration

Advanced filtering with form-based interface:

```typescript
filter: {
  fields: [
    {
      type: 'text',
      name: 'email',
      label: 'Email'
    },
    {
      type: 'select',
      name: 'status',
      label: 'Status',
      items: ['active', 'blocked'],
      multiple: true,
      value: ['active']
    }
  ],
  actions: [{ name: 'apply' }, { name: 'cancel' }],
  actionSubmit: 'apply',
  actionCancel: 'cancel',
  cols: 2
}
```

### Table-Level Actions

Actions that apply to the entire table:

```typescript
actions: [
  {
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
```

### Pagination

Tables are paginated with configurable items per page:

```typescript
{
  itemsPerPage: 10,    // Items to display per page
  currentPage: 1       // Starting page
}
```

Navigation buttons appear in the table footer:
- **Previous** - Disabled on first page
- **Next** - Disabled when fewer items than limit returned
- **Refresh** - Appears when `canRefresh: true`

### Data Format

Table data is an array of objects where object keys match column `name` properties:

```typescript
type OvTableData = Record<string, unknown>

const data: OvTableData[] = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1-555-0123',
    status: 'active'
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1-555-0456',
    status: 'inactive'
  }
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
    text: 'High'
  },
  {
    rules: { type: 'less-than', params: 10 },
    color: 'error',
    text: 'Low'
  },
  { color: 'warning' }  // Default fallback
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

| Parameter | Type | Example |
|-----------|------|---------|
| `data` | `OvTableData[]` | Current page data |
| `offset` | `number` | `0` for first page, `10` for second (with itemsPerPage: 10) |
| `limit` | `number` | `11` (itemsPerPage + 1 to detect more pages) |
| `search` | `string` | `"search term"` or `""` |
| `filter` | `string` | `"status[active,blocked],phone[5551234]"` |
| `sort` | `string` | `"name,status-desc"` or `""` |

### Filter String Format

Multiple filters use comma separation with bracket notation:

```
status[active],phone[555-1234]
status[active,blocked]  // Multiple values for same field
```

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

