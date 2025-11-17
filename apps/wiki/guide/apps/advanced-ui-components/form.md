# Form

Flexible form component with built-in validation, customizable fields, and action handling. Supports text, email, password, textarea, number, select, checkbox, switch, rating, file, and date/time inputs.

## Overview

`VOvForm` provides a comprehensive form solution with configurable fields, validation rules, custom actions, and error handling. It supports 13+ field types with Vuetify integration, automatic layout management, and responsive grid columns. The component handles form submission, validation, and custom actions with TypeScript support throughout.

**Features:**
- 13+ field types (text, email, password, textarea, number, select, checkbox, switch, rating, file, date, time, datetime)
- Built-in validation with 20+ rule types
- Customizable actions with formatters
- Responsive grid layout with configurable columns
- Error display and server-side error handling
- v-model support for form data binding
- Auto-focus on first field or validation errors
- Loading state with overlay indicator
- Full TypeScript support

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-form.vue 
:::

## API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `OvFormOptions` | - | **Required.** Form configuration with fields, actions, and validation |
| `data` | `OvFormData` | `undefined` | Form data object for initializing field values |
| `loading` | `boolean` | `false` | Show loading overlay with spinner |
| `t` | `(text?: string) => string` | `(text) => text` | Translation/localization function for labels and messages |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `submit` | `OvFormData` | Emitted when form is submitted and validation passes |
| `validate` | `OvFormData, errors?: unknown` | Emitted when validate action is triggered |
| `cancel` | - | Emitted when cancel action is clicked |
| `reset` | - | Emitted when form is reset to initial values |
| `action` | `actionName: string, OvFormData` | Emitted when custom action is triggered |

### Form Options

```typescript
interface OvFormOptions {
  // Required
  fields: OvFormField[]

  // Optional - Actions
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
  actionAlign?: 'left' | 'center' | 'right'
  actionSubmit?: string
  actionReset?: string
  actionValidate?: string
  actionCancel?: string

  // Optional - Form behavior
  autocomplete?: 'on' | 'off'
  disabled?: boolean
  readonly?: boolean
  fastFail?: boolean
  cols?: number
  focusFirst?: boolean

  // Optional - Error handling
  errors?: OvFormFieldError[]
}
```

### Field Types

#### Base Field Properties
All field types share these properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | `string` | - | **Required.** Field type identifier |
| `name` | `string` | - | **Required.** Unique field identifier for data binding |
| `label` | `string` | - | Field label text |
| `placeholder` | `string` | - | Input placeholder text |
| `value` | `unknown` | - | Initial/default field value |
| `required` | `boolean` | - | Mark field as required |
| `disabled` | `boolean` | - | Disable field input |
| `readonly` | `boolean` | - | Make field read-only |
| `hidden` | `boolean` | - | Hide field from form |
| `variant` | `string` | - | Vuetify input variant (underlined, outlined, filled, etc.) |
| `density` | `string` | - | Input density (default, comfortable, compact) |
| `color` | `string` | - | Field color |
| `clearable` | `boolean` | - | Show clear button |
| `counter` | `number` | - | Character counter limit |
| `hint` | `string` | - | Helper text below field |
| `prefix` | `string` | - | Text prefix in field (text types) |
| `suffix` | `string` | - | Text suffix in field (text types) |
| `prependIcon` | `string` | - | Icon before input |
| `appendIcon` | `string` | - | Icon after input |
| `prependInnerIcon` | `string` | - | Icon inside at start |
| `appendInnerIcon` | `string` | - | Icon inside at end |
| `autocomplete` | `'on' \| 'off'` | - | Auto-complete behavior |
| `rules` | `OvRule[]` | - | Validation rules |
| `errors` | `string[]` | - | Field-specific error messages |

#### Text Input Fields
Basic text input with optional prefix/suffix:

```typescript
{
  type: 'text',
  name: 'username',
  label: 'Username',
  placeholder: 'Enter username',
  counter: 50
}
```

#### Email Field
Email input with built-in email validation:

```typescript
{
  type: 'email',
  name: 'email',
  label: 'Email Address',
  placeholder: 'Enter your email'
}
```

#### Password Field
Password input with show/hide toggle:

```typescript
{
  type: 'password',
  name: 'password',
  label: 'Password',
  placeholder: 'Enter password',
  appendInnerIcon: '$mdiEye'
}
```

#### Number Field
Numeric input field:

```typescript
{
  type: 'number',
  name: 'quantity',
  label: 'Quantity',
  placeholder: 'Enter amount'
}
```

#### Textarea Field
Multi-line text input with optional auto-grow:

```typescript
{
  type: 'textarea',
  name: 'description',
  label: 'Description',
  placeholder: 'Enter description',
  rows: 5,
  counter: 500,
  autoGrow: true,
  noResize: true
}
```

**Textarea-specific properties:**
- `rows` (number) - Initial row count
- `autoGrow` (boolean) - Auto-expand as user types
- `noResize` (boolean) - Disable manual resizing

#### Switch Field
Toggle switch input:

```typescript
{
  type: 'switch',
  name: 'acceptTerms',
  label: 'I accept terms and conditions',
  value: false
}
```

#### Checkbox Field
Checkbox input:

```typescript
{
  type: 'checkbox',
  name: 'newsletter',
  label: 'Subscribe to newsletter'
}
```

#### Rating Field
Star rating input:

```typescript
{
  type: 'rating',
  name: 'satisfaction',
  label: 'How satisfied are you?',
  length: 5,
  size: 24,
  color: 'amber'
}
```

**Rating-specific properties:**
- `length` (number) - Number of stars (default: 5)
- `size` (number) - Star size in pixels
- `itemLabels` (string[]) - Labels for each rating level

#### Select Field
Dropdown select with single or multiple selection:

```typescript
{
  type: 'select',
  name: 'country',
  label: 'Select Country',
  items: ['USA', 'Canada', 'Mexico'],
  multiple: false,
  chips: false
}
```

**Selection-specific properties:**
- `items` (string[]) - Array of selectable items
- `multiple` (boolean) - Allow multiple selections
- `chips` (boolean) - Display selected items as chips

#### Combobox Field
Autocomplete-enabled select with custom input:

```typescript
{
  type: 'combobox',
  name: 'tags',
  label: 'Tags',
  items: ['React', 'Vue', 'Angular'],
  multiple: true,
  chips: true
}
```

#### Autocomplete Field
Autocomplete with filtering:

```typescript
{
  type: 'autocomplete',
  name: 'city',
  label: 'Select City',
  items: ['New York', 'Los Angeles', 'Chicago'],
  multiple: false
}
```

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

| Rule Type | Params | Description |
|-----------|--------|-------------|
| `required` | `true` | Value must not be empty |
| `min-length` | `number` | String length must be >= params |
| `max-length` | `number` | String length must be <= params |
| `equals` | `any` | Value must equal params |
| `equals-not` | `any` | Value must not equal params |
| `starts-with` | `string` | String must start with params |
| `ends-with` | `string` | String must end with params |
| `contains` | `string` | String must contain params |
| `greater-than` | `number` | Number must be > params |
| `less-than` | `number` | Number must be < params |
| `in-range` | `[min, max]` | Number must be >= min and <= max |
| `includes` | `any[]` | Value must be in params array |
| `set` | `any[]` | Value must be in params array |
| `password` | `true` | Strong password (letters + digits, 8+ chars) |
| `email` | `true` | Valid email format |
| `url` | `true` | Valid URL format |
| `ip` | `true` | Valid IPv4 address |
| `regexp` | `RegExp string` | Value must match regexp |
| `same-as` | `any` | Value must equal params |
| `is-json` | `true` | Valid JSON string |
| `custom` | `(value) => boolean` | Custom validation function |

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
      text: 'Export Data'
    }
  }
]
```

#### Built-in Action Types

| Action | Handler | Event |
|--------|---------|-------|
| `submit` | Validates all fields and submits if valid | `submit` |
| `validate` | Validates all fields without submitting | `validate` |
| `reset` | Resets form to initial values | `reset` |
| `cancel` | Cancels form editing | `cancel` |
| Custom | User-defined action | `action` |

### Field Errors

Server-side or programmatic errors can be displayed on fields:

```typescript
errors: [
  {
    name: 'email',
    message: 'This email is already registered'
  },
  {
    name: 'username',
    message: 'Username already taken'
  }
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
