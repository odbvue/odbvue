# Form

## Overview

`VOvForm` is the project form shell: it renders a configurable field list, handles validation and action routing, and normalizes special field values such as durations and switches before emit or submit. The sandbox page shows the full surface, but the component itself is driven by the `options` object plus optional initial `data`.

## Dependencies

- `vue`
- `vuetify`
- `vue-i18n`
- `@tiptap/vue-3`
- `@tiptap/starter-kit`
- `@tiptap/markdown`
- `@tiptap/extension-image`

## Usage

```vue
<template>
  <v-ov-form
    :options="options"
    :data="formData"
    :loading="loading"
    :t="t"
    @submit="submit"
    @cancel="cancel"
    @action="action"
  />
</template>

<script setup lang="ts">
import type { OvFormOptions } from '@/components'

const loading = ref(false)
const formData = ref({ name: 'Jane', email: 'jane@example.com' })
const { t } = useI18n()

const options = ref<OvFormOptions>({
  cols: 2,
  fields: [
    { type: 'text', name: 'name', label: 'Name' },
    { type: 'email', name: 'email', label: 'Email' },
  ],
  actions: ['cancel', 'submit'],
  actionCancel: 'cancel',
  actionSubmit: 'submit',
})
</script>
```

## API

### Props

| Prop          | Type                        | Default     | Description                                   |
| ------------- | --------------------------- | ----------- | --------------------------------------------- |
| `options`     | `OvFormOptions`             | required    | Form configuration, field list, and actions.  |
| `data`        | `OvFormData`                | `undefined` | Initial or refreshed form data.               |
| `loading`     | `boolean`                   | `false`     | Shows the contained loading overlay.          |
| `hideActions` | `boolean`                   | `false`     | Hides the bottom action row.                  |
| `title`       | `string`                    | -           | Optional heading rendered above the form.     |
| `description` | `string`                    | -           | Optional description rendered above the form. |
| `t`           | `(text?: string) => string` | identity    | Translation function for labels and messages. |

### Emits

| Event      | Payload                                                      | Description                                              |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `action`   | `(actionName: string, formData: OvFormData)`                 | Emitted for custom action buttons.                       |
| `cancel`   | -                                                            | Emitted when a cancel action is triggered.               |
| `reset`    | -                                                            | Emitted when the form is reset.                          |
| `submit`   | `(formData: OvFormData)`                                     | Emitted after validation passes and submit is triggered. |
| `validate` | `(formData: OvFormData, errors?: unknown)`                   | Emitted when validation runs.                            |
| `change`   | `(fieldName: string, value: unknown, allValues: OvFormData)` | Emitted on each field change.                            |

### Exposed

| Property                                | Type                                                                 | Description                                     |
| --------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `focusField(fieldName, position)`       | `(fieldName: string, position?: 'start' \| 'end' \| number) => void` | Focuses a field or its embedded editor.         |
| `scrollToAndFocus(fieldName, position)` | `(fieldName: string, position?: 'start' \| 'end' \| number) => void` | Scrolls the form into view and focuses a field. |
| `formRef`                               | `Ref`                                                                | Template ref for the `v-form` instance.         |
| `values`                                | `Ref<Record<string, unknown>>`                                       | Current internal form values.                   |
| `actions`                               | `ComputedRef`                                                        | Resolved action metadata.                       |
| `handleAction(name)`                    | `(name: string) => void`                                             | Triggers the named action.                      |
| `validate()`                            | `() => Promise`                                                      | Runs form validation.                           |
| `getValues()`                           | `() => OvFormData`                                                   | Returns transformed values ready for submit.    |

### Slots

| Slot                | Scope              | Description                                     |
| ------------------- | ------------------ | ----------------------------------------------- |
| `title`             | -                  | Replaces the top title heading.                 |
| `description`       | -                  | Replaces the top description paragraph.         |
| `field-{fieldName}` | `{ value, field }` | Replaces the label area for the matching field. |

### Field Types

The form currently supports `text`, `email`, `password`, `textarea`, `markdown`, `number`, `switch`, `rating`, `checkbox`, `select`, `combobox`, `autocomplete`, `file`, `color`, `date`, `time`, `datetime`, `duration`, and `custom` fields.

Notable field-specific options:

- `textarea`: `rows`, `noResize`, `autoGrow`
- `markdown`: `toolbar`, `toolbarClass`, `editorClass`, `minHeight`, `maxHeight`, `imageUploader`, `imageUrlResolver`
- `rating`: `length`, `size`, `itemLabels`
- `select` / `combobox` / `autocomplete`: `items`, `fetchItems`, `debounce`, `minSearchLength`, `multiple`, `chips`, `format.value`
- `file`: `multiple`, `accept`
- `color`: `showAlpha`, `swatches`, `modes`
- `custom`: `component`, `props`

### Notes

- Duration fields are converted to and from compact duration strings.
- Switch fields are normalized to booleans internally and converted back to the original format on submit.
- Custom fields can be lazy-loaded components.
- `actionSubmit`, `actionCancel`, `actionReset`, and `actionValidate` are matched by action name.
  { title: 'USA', value: 'us' },
  { title: 'Canada', value: 'ca' },
  { title: 'Mexico', value: 'mx' }
  ],
  multiple: false,
  chips: false
  }

````

**Selection-specific properties:**
- `items` (`OvFormSelectItem[]`) - Array of selectable items with `{ title: string, value: unknown }` structure
- `multiple` (boolean) - Allow multiple selections
- `chips` (boolean) - Display selected items as chips
- `itemTitle` (string) - Property name for display text (default: `'title'`)
- `itemValue` (string) - Property name for the value (default: `'value'`)
- `fetchItems` (`(search: string) => Promise<OvFormSelectItem[]>`) - Async function to fetch items dynamically
- `debounce` (number) - Debounce delay in milliseconds for async search (default: 300)
- `minSearchLength` (number) - Minimum characters required before triggering search (default: 0)

#### Combobox Field
Autocomplete-enabled select with custom input:

```typescript
{
  type: 'combobox',
  name: 'tags',
  label: 'Tags',
  items: [
    { title: 'React', value: 'react' },
    { title: 'Vue', value: 'vue' },
    { title: 'Angular', value: 'angular' }
  ],
  multiple: true,
  chips: true
}
````

#### Autocomplete Field

Autocomplete with filtering:

```typescript
{
  type: 'autocomplete',
  name: 'city',
  label: 'Select City',
  items: [
    { title: 'New York', value: 'ny' },
    { title: 'Los Angeles', value: 'la' },
    { title: 'Chicago', value: 'chi' }
  ],
  multiple: false
}
```

#### Autocomplete with Async Data

Autocomplete with dynamic API-driven items:

```typescript
{
  type: 'autocomplete',
  name: 'assignee',
  label: 'Assignee',
  clearable: true,
  fetchItems: async (search: string) => {
    const response = await http.get('/api/users', { params: { search } })
    return response.data.map(user => ({
      title: user.fullname,
      value: user.uuid
    }))
  },
  itemValue: 'value',
  itemTitle: 'title',
  debounce: 300,
  minSearchLength: 1
}
```

The `fetchItems` function is called with the search string whenever the user types (after debounce delay). The component automatically:

- Debounces API calls to avoid excessive requests
- Shows a loading indicator while fetching
- Preserves selected items so they display correctly even when search results change
- Supports custom `itemValue` and `itemTitle` property mappings

#### File Field

File input field:

```typescript
{
  type: 'file',
  name: 'attachment',
  label: 'Upload File',
  clearable: true
}
```

#### Date Field

Date picker input:

```typescript
{
  type: 'date',
  name: 'birthDate',
  label: 'Date of Birth',
  placeholder: 'YYYY-MM-DD'
}
```

#### Time Field

Time picker input:

```typescript
{
  type: 'time',
  name: 'eventTime',
  label: 'Event Time',
  placeholder: 'HH:MM'
}
```

#### Datetime Field

Combined date and time picker:

```typescript
{
  type: 'datetime',
  name: 'eventDateTime',
  label: 'Event Date and Time',
  placeholder: 'YYYY-MM-DDTHH:MM'
}
```

### Validation Rules

Validation rules are applied to fields through the `rules` array:

```typescript
{
  type: 'text',
  name: 'username',
  rules: [
    {
      type: 'required',
      params: true,
      message: 'Username is required'
    },
    {
      type: 'min-length',
      params: 3,
      message: 'Username must be at least 3 characters'
    }
  ]
}
```

#### Available Rule Types

| Rule Type      | Params               | Description                                  |
| -------------- | -------------------- | -------------------------------------------- |
| `required`     | `true`               | Value must not be empty                      |
| `min-length`   | `number`             | String length must be >= params              |
| `max-length`   | `number`             | String length must be <= params              |
| `equals`       | `any`                | Value must equal params                      |
| `equals-not`   | `any`                | Value must not equal params                  |
| `starts-with`  | `string`             | String must start with params                |
| `ends-with`    | `string`             | String must end with params                  |
| `contains`     | `string`             | String must contain params                   |
| `greater-than` | `number`             | Number must be > params                      |
| `less-than`    | `number`             | Number must be < params                      |
| `in-range`     | `[min, max]`         | Number must be >= min and <= max             |
| `includes`     | `any[]`              | Value must be in params array                |
| `set`          | `any[]`              | Value must be in params array                |
| `password`     | `true`               | Strong password (letters + digits, 8+ chars) |
| `email`        | `true`               | Valid email format                           |
| `url`          | `true`               | Valid URL format                             |
| `ip`           | `true`               | Valid IPv4 address                           |
| `regexp`       | `RegExp string`      | Value must match regexp                      |
| `same-as`      | `any`                | Value must equal params                      |
| `is-json`      | `true`               | Valid JSON string                            |
| `custom`       | `(value) => boolean` | Custom validation function                   |

### Actions

Actions are buttons displayed at the bottom of the form:

```typescript
// Built-in actions (string shorthand)
actions: ['submit', 'reset', 'cancel', 'validate']

// Custom actions with formatting
actions: [
  { name: 'submit' },
  {
    name: 'export',
    format: {
      color: 'blue',
      icon: '$mdiDownload',
      text: 'Export Data',
    },
  },
]
```

#### Built-in Action Types

| Action     | Handler                                   | Event      |
| ---------- | ----------------------------------------- | ---------- |
| `submit`   | Validates all fields and submits if valid | `submit`   |
| `validate` | Validates all fields without submitting   | `validate` |
| `reset`    | Resets form to initial values             | `reset`    |
| `cancel`   | Cancels form editing                      | `cancel`   |
| Custom     | User-defined action                       | `action`   |

### Field Errors

Server-side or programmatic errors can be displayed on fields:

```typescript
errors: [
  {
    name: 'email',
    message: 'This email is already registered',
  },
  {
    name: 'username',
    message: 'Username already taken',
  },
]
```

### Responsive Behavior

The form uses Vuetify's grid system for responsive layout:

- `cols` prop determines column count on desktop (1-12)
- Automatically switches to single column on mobile devices
- Use `OvForm` props to configure layout

## Styling

The form uses Vuetify defaults provider for consistent styling:

- `.v-form` - Main form container
- `.v-container` - Form content wrapper (class: `position-relative`)
- `.v-overlay` - Loading overlay (class: `rounded`)
- Form action buttons have `ma-1` class by default

## Notes

- The form validates on invalid input after first interaction (`validate-on="invalid-input"`)
- Password fields automatically show/hide toggle button
- Rating and checkbox fields have primary color by default if not specified
- Server-side errors override built-in validation messages
- Form state resets when `data` prop is cleared
- All labels and messages respect the `t` translation function
- Long-running form submissions should use the `loading` prop to prevent double-submission
- Mobile devices always render single-column layout regardless of `cols` setting
- The `change` event is emitted for each field when its value changes, enabling real-time reactivity and dynamic form behavior
