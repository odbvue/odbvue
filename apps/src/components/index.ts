export type OvRule = {
  type:
    | 'required'
    | 'min-length'
    | 'max-length'
    | 'equals'
    | 'equals-not'
    | 'starts-with'
    | 'ends-with'
    | 'contains'
    | 'greater-than'
    | 'less-than'
    | 'in-range'
    | 'includes'
    | 'set'
    | 'password'
    | 'email'
    | 'url'
    | 'ip'
    | 'regexp'
    | 'same-as'
    | 'is-json'
    | 'custom'
  params: unknown
  message?: string
}

export type OvFormat = {
  rules?: OvRule | OvRule[]
  text?: string
  icon?: string
  color?: string
  variant?: 'flat' | 'outlined' | 'plain' | 'text' | 'elevated' | 'tonal'
  density?: 'compact' | 'default' | 'comfortable'
  size?: 'x-small' | 'small' | 'default' | 'large' | 'x-large'
  rounded?: boolean
  class?: string
  to?: string
  href?: string
  target?: string
  hidden?: boolean
}
export type OvAction =
  | {
      key?: string
      name: string
      format?: OvFormat | OvFormat[]
      form?: OvFormOptions
    }
  | string

type OvFormFieldBase = {
  type:
    | 'text'
    | 'email'
    | 'password'
    | 'textarea'
    | 'number'
    | 'switch'
    | 'rating'
    | 'checkbox'
    | 'select'
    | 'combobox'
    | 'autocomplete'
    | 'file'
    | 'date'
    | 'time'
    | 'datetime'
  name: string
  value?: unknown
  label?: string
  placeholder?: string
  autocomplete?: 'off' | 'on'
  hint?: string
  prefix?: string
  suffix?: string
  prependIcon?: string
  appendIcon?: string
  prependInnerIcon?: string
  appendInnerIcon?: string
  required?: boolean
  readonly?: boolean
  hidden?: boolean
  disabled?: boolean
  clearable?: boolean
  variant?:
    | 'underlined'
    | 'outlined'
    | 'filled'
    | 'solo'
    | 'solo-inverted'
    | 'solo-filled'
    | 'plain'
  density?: 'default' | 'comfortable' | 'compact'
  color?: string
  rules?: OvRule[]
  errors?: string[]
  counter?: number
}

export type OvFormTextareaField = OvFormFieldBase & {
  type: 'textarea'
  rows?: number
  noResize?: boolean
  autoGrow?: boolean
}

export type OvFormRatingField = OvFormFieldBase & {
  type: 'rating'
  length?: number
  size?: number
  itemLabels?: string[]
}

export type OvFormSelectionField = OvFormFieldBase & {
  type: 'select' | 'combobox' | 'autocomplete'
  items?: string[]
  chips?: boolean
  multiple?: boolean
}

type OvFormFileField = OvFormFieldBase & {
  type: 'file'
}

type OvFormField =
  | OvFormFieldBase
  | OvFormTextareaField
  | OvFormRatingField
  | OvFormSelectionField
  | OvFormFileField

export type OvFormFieldError = {
  name: string
  message: string
}

export type OvAlign = 'left' | 'center' | 'right'

export type OvFormOptions = {
  fields: OvFormField[]
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
  actionAlign?: OvAlign
  actionSubmit?: string
  actionReset?: string
  actionValidate?: string
  actionCancel?: string
  autocomplete?: 'on' | 'off'
  disabled?: boolean
  readonly?: boolean
  fastFail?: boolean
  errors?: OvFormFieldError[]
  cols?: number
  focusFirst?: boolean
}

export type OvTableColumn = {
  name: string
  title?: string
  format?: OvFormat | OvFormat[]
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
  maxLength?: number
  align?: OvAlign
}

type OvTableSort = {
  name: string
  label?: string
  value?: 'asc' | 'desc'
}

export type OvFilterValue = Record<string, string[]>

export type OvTableOptions = {
  key: string
  columns: OvTableColumn[]
  columnFormat?: OvFormat | OvFormat[]
  search?: {
    value?: string
    label?: string
    placeholder?: string
  }
  filter?: OvFormOptions
  sort?: OvTableSort[]
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
  itemsPerPage?: number
  currentPage?: number
  canRefresh?: boolean
  maxLength?: number
  align?: OvAlign
}

export type OvViewItem = {
  name: string
  label?: string
  format?: OvFormat | OvFormat[]
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
  maxLength?: number
}

export type OvViewOptions = {
  cols?: number
  items: OvViewItem[]
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
  actionAlign?: OvAlign
  maxLength?: number
}

export type OvFormData = Record<string, unknown>
export type OvTableData = Record<string, unknown>
export type OvViewData = Record<string, unknown>

export const OvRuleValidate = (
  value?: unknown,
  rule?: string,
  params?: unknown,
  message?: string,
): boolean | string => {
  if (!rule) return message || false
  const validationRules: Record<string, () => boolean | string> = {
    required: () => !!value || message || false,
    'min-length': () =>
      (typeof value === 'string' && value.length >= Number(params)) || message || false,
    'max-length': () =>
      (typeof value === 'string' && value.length <= Number(params)) || message || false,
    equals: () => value === params || message || false,
    'equals-not': () => value !== params || message || false,
    'starts-with': () =>
      (typeof value === 'string' && value.startsWith(params as string)) || message || false,
    'ends-with': () =>
      (typeof value === 'string' && value.endsWith(params as string)) || message || false,
    contains: () =>
      (typeof value === 'string' && value.includes(params as string)) || message || false,
    'greater-than': () => Number(value) > Number(params) || message || false,
    'less-than': () => Number(value) < Number(params) || message || false,
    'in-range': () => {
      const [min, max] = params as [number, number]
      return (Number(value) >= min && Number(value) <= max) || message || false
    },
    includes: () => (Array.isArray(params) && params.includes(value)) || message || false,
    set: () => (Array.isArray(params) && params.includes(value)) || message || false,
    password: () =>
      /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(value as string) || message || false,
    email: () => /^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/.test(value as string) || message || false,
    url: () =>
      /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/\S*)?$/.test(value as string) || message || false,
    ip: () =>
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
        value as string,
      ) ||
      message ||
      false,
    regexp: () => new RegExp(String(params)).test(value as string) || message || false,
    'same-as': () => value === params || message || false,
    'is-json': () =>
      (typeof value === 'string' &&
        (() => {
          try {
            JSON.parse(value)
            return true
          } catch {
            return false
          }
        })()) ||
      message ||
      false,
    custom: () => (typeof params === 'function' && params(value)) || message || false,
  }
  return validationRules[rule] ? validationRules[rule]() : message || false
}

function formatValidate(value: unknown, format?: OvFormat | OvFormat[]): OvFormat {
  if (!format) return {}
  const formats = Array.isArray(format) ? format : [format]
  for (const fmt of formats) {
    if (!fmt?.rules) return fmt
    const rules = Array.isArray(fmt.rules) ? fmt.rules : [fmt.rules]
    if (rules.length === 0) return fmt
    const isValid = rules.some(
      (rule) => !!OvRuleValidate(value, rule?.type, rule?.params, rule?.message),
    )
    if (isValid) return fmt
  }
  return {}
}

export const OvTextAlign = (align: 'left' | 'center' | 'right' | undefined) =>
  align ?? `text-${align}`

export const OvFormat = (value: unknown, format?: OvFormat | OvFormat[]) => {
  const fmt = formatValidate(value, format)
  return Object.fromEntries(
    Object.entries({
      icon: fmt.icon,
      text: fmt.text,
      color: fmt.color,
      class: fmt.class,
      hidden: fmt.hidden,
      size: fmt.size,
      density: fmt.density,
      variant: fmt.variant,
      rounded: fmt.rounded,
      to: fmt.to,
      href: fmt.href,
      target: fmt.target,
    }).filter(([, value]) => value !== undefined),
  )
}

export const OvActionFormat = (
  value: unknown,
  action: OvAction,
  actionFormat?: OvFormat | OvFormat[],
) => {
  if (typeof action === 'string') return { name: action, text: action }
  const fmt = OvFormat(value, action.format)
  const actionFmt = OvFormat(value, actionFormat)
  fmt.text = fmt.icon ? undefined : fmt.text || action.name
  fmt.name = action.name
  return { ...actionFmt, ...fmt }
}

import { h } from 'vue'
import { VLabel, VIcon, VChip, VBtn } from 'vuetify/components'

export const renderViewItem = (
  value: unknown,
  item?: OvViewItem,
  data?: OvViewData,
  options?: OvViewOptions,
  onEmit?: (event: string, ...args: unknown[]) => void,
) => {
  return () => {
    if (typeof value === 'object' && value !== null) {
      value = JSON.stringify(value, null, 2)
    }

    const valueStr = String(value ?? '')
    const valueDsp = valueStr.slice(0, item?.maxLength ?? options?.maxLength ?? 32767)
    const isTrimmed = item?.maxLength === 0 || valueStr.length > valueDsp.length
    const chipProps = OvFormat(valueStr, item?.format)

    const children: (ReturnType<typeof h> | string)[] = []

    if (!chipProps.hidden) {
      if (item?.label) {
        children.push(
          h(
            VLabel,
            {
              size: 'x-small',
            },
            {
              default: () => item?.label,
            },
          ),
        )
        children.push(h('br'))
      }

      if (item?.format) {
        const slots: Record<string, () => unknown> = {
          default: () => valueDsp,
        }

        if (chipProps.href && typeof chipProps.href === 'string') {
          chipProps.href = chipProps.href.replace('{{value}}', valueStr)
        }

        if (chipProps.to && typeof chipProps.to === 'string') {
          chipProps.to = chipProps.to.replace('{{value}}', valueStr)
        }

        if (chipProps.icon) {
          slots.prepend = () =>
            h(VIcon, {
              icon: chipProps.icon as string,
              start: true,
            })
        }

        children.push(h(VChip, chipProps, slots))
      } else if (valueDsp) {
        children.push(h('span', {}, valueDsp))
      }

      if (isTrimmed) {
        children.push(
          h(VBtn, {
            icon: '$mdiDotsHorizontal',
            variant: 'text',
            onClick: () => {
              onEmit?.('details', item?.label ?? item?.name ?? '', valueStr)
            },
          }),
        )
      }
    }

    item?.actions?.forEach((action) => {
      const actionObj = typeof action === 'string' ? { name: action } : action
      const actionVal = actionObj.key ? (data ?? {})[actionObj.key] : value
      const props = OvActionFormat(actionVal, actionObj, options?.actionFormat)
      const hidden = (props as Record<string, unknown>)['hidden'] === true
      if (!hidden) {
        children.push(
          h(VBtn, {
            ...props,
            onClick: () => {
              onEmit?.('action', actionObj.name, valueStr)
            },
          }),
        )
      }
    })

    return h('span', {}, children)
  }
}
