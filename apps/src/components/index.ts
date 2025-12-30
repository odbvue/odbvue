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
  html?: boolean
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
    | 'markdown'
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
    | 'duration'
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

export type OvFormMarkdownField = OvFormFieldBase & {
  type: 'markdown'
  toolbar?: string[]
  toolbarClass?: string
  editorClass?: string
  minHeight?: string
  maxHeight?: string
}

export type OvFormRatingField = OvFormFieldBase & {
  type: 'rating'
  length?: number
  size?: number
  itemLabels?: string[]
}

export type OvFormSelectItem = {
  title: string
  value: unknown
}

export type OvFormSelectionField = OvFormFieldBase & {
  type: 'select' | 'combobox' | 'autocomplete'
  items?: (string | OvFormSelectItem)[]
  fetchItems?: (search: string) => Promise<OvFormSelectItem[]>
  debounce?: number
  minSearchLength?: number
  itemValue?: string
  itemTitle?: string
  chips?: boolean
  multiple?: boolean
}

export type OvFormFileField = OvFormFieldBase & {
  type: 'file'
  multiple?: boolean
  accept?: string
}

export type OvFormFileData = {
  name: string
  type: string
  size: number
  content: string // base64 encoded
}

/**
 * Converts a File object to a serializable format with base64 content
 */
export async function fileToBase64(file: File): Promise<OvFormFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] || ''
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        content: base64,
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Processes form data and converts any File objects to base64 format
 */
export async function processFormDataWithFiles(formData: OvFormData): Promise<OvFormData> {
  const result: OvFormData = {}

  for (const [key, value] of Object.entries(formData)) {
    if (value instanceof File) {
      result[key] = await fileToBase64(value)
    } else if (value instanceof FileList || (Array.isArray(value) && value[0] instanceof File)) {
      const files = Array.from(value as FileList | File[])
      result[key] = await Promise.all(files.map(fileToBase64))
    } else {
      result[key] = value
    }
  }

  return result
}

type OvFormField =
  | OvFormFieldBase
  | OvFormTextareaField
  | OvFormMarkdownField
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
  label?: string
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
  alwaysMobile?: boolean
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

export const OvFieldFormat = (value: unknown, format?: OvFormat | OvFormat[]) => {
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
      html: fmt.html,
    }).filter(([, value]) => value !== undefined),
  )
}

export const OvActionFormat = (
  value: unknown,
  action: OvAction,
  actionFormat?: OvFormat | OvFormat[],
) => {
  if (typeof action === 'string') return { name: action, text: action }
  const fmt = OvFieldFormat(value, action.format)
  const actionFmt = OvFieldFormat(value, actionFormat)
  fmt.text = fmt.icon ? undefined : fmt.text || action.name
  fmt.name = action.name
  return { ...actionFmt, ...fmt }
}

import { h, ref } from 'vue'
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
    const chipProps = OvFieldFormat(valueStr, item?.format)

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

      if (chipProps.html && isTrimmed === false) {
        children.push(h('div', { innerHTML: valueStr }))
      } else {
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
      }

      if (isTrimmed && valueStr) {
        children.push(
          h(VBtn, {
            icon: '$mdiDotsHorizontal',
            variant: 'text',
            size: 'x-small',
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

      if ((props as Record<string, unknown>).to && actionObj.key) {
        ;(props as Record<string, unknown>).to = (
          (props as Record<string, unknown>).to as string
        ).replace('{{value}}', (data ?? {})[actionObj.key] as string)
      }

      const hidden = (props as Record<string, unknown>)['hidden'] === true
      const isNavigationAction =
        !!(props as Record<string, unknown>).to || !!(props as Record<string, unknown>).href
      if (!hidden) {
        children.push(
          h(VBtn, {
            ...props,
            ...(isNavigationAction
              ? {}
              : { onClick: () => onEmit?.('action', actionObj.name, valueStr) }),
          }),
        )
      }
    })

    return h('span', {}, children)
  }
}

// Table Fetch Composable

import { useHttp } from '@/composables/http'
import type { Ref } from 'vue'

export interface UseTableFetchOptions<T> {
  endpoint: string
  responseKey: keyof T
  filter?: OvFilterValue
  search?: string
}

export interface UseTableFetchReturn {
  loading: Ref<boolean>
  data: Ref<OvTableData[]>
  fetch: (
    fetchData: OvTableData[],
    offset: number,
    limit: number,
    search: string,
    filter: OvFilterValue,
    sort: string,
  ) => Promise<void>
}

export function useTableFetch<T extends Record<string, unknown>>(
  options: UseTableFetchOptions<T>,
): UseTableFetchReturn {
  const http = useHttp()
  const loading = ref(false)
  const data = ref<OvTableData[]>([])

  const fetch = async (
    _fetchData: OvTableData[],
    offset: number,
    limit: number,
    search: string,
    filter: OvFilterValue,
    sort: string,
  ) => {
    loading.value = true
    try {
      const searchValue = options.search || search
      const filterValue = { ...filter, ...options.filter }
      const { data: response } = await http.get<T>(options.endpoint, {
        params: {
          offset,
          limit,
          search: searchValue ? encodeURIComponent(searchValue) : '',
          filter: encodeURIComponent(JSON.stringify(filterValue)),
          sort,
        },
      })

      if (response) {
        const items = response[options.responseKey]
        data.value = Array.isArray(items) ? items : []
      }
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    data,
    fetch,
  }
}

// Table Form Action Composable

export interface UseFormActionOptions {
  endpoint?: string
  endpoints?: Record<string, string>
  transformPayload?: (actionName: string, payload: OvFormData) => OvFormData
  refetchOn?: string[]
  onSuccess?: (actionName: string, payload: OvFormData) => void
}

export interface UseFormActionReturn {
  loading: Ref<boolean>
  action: (
    name: string,
    item: OvFormData,
    value?: OvFormData,
    callback?: (errors?: OvFormFieldError[], shouldRefetch?: boolean) => void,
  ) => Promise<void>
}

export function useFormAction(options: UseFormActionOptions): UseFormActionReturn {
  const http = useHttp()
  const loading = ref(false)

  const getEndpoint = (actionName: string): string => {
    if (options.endpoints?.[actionName]) {
      return options.endpoints[actionName]
    }
    if (options.endpoint) {
      return options.endpoint
    }
    throw new Error(`No endpoint configured for action: ${actionName}`)
  }

  const shouldRefetch = (actionName: string): boolean => {
    if (!options.refetchOn) return false
    return options.refetchOn.includes(actionName)
  }

  const action = async (
    name: string,
    _item: OvFormData,
    value?: OvFormData,
    callback?: (errors?: OvFormFieldError[], shouldRefetch?: boolean) => void,
  ) => {
    loading.value = true
    try {
      let payload = value
      if (options.transformPayload && payload) {
        payload = options.transformPayload(name, payload)
      }
      const endpoint = getEndpoint(name)
      const res: { data?: { errors?: OvFormFieldError[] } | null } = await http.post(
        endpoint,
        payload,
      )
      if (res?.data && res.data.errors) {
        callback?.(res.data.errors, false)
      } else {
        if (value) {
          options.onSuccess?.(name, value)
        }
        callback?.(undefined, shouldRefetch(name))
      }
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    action,
  }
}

/**
 * Duration constants for JIRA-style effort tracking
 * w = week (40 hours), d = day (8 hours), h = hour (60 minutes), m = minute
 */
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 8
const HOURS_PER_WEEK = 40
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR
const MINUTES_PER_WEEK = HOURS_PER_WEEK * MINUTES_PER_HOUR

/**
 * Converts minutes (numeric) to JIRA-style duration string (e.g., "2w 3d 4h 15m")
 * @param minutes - Total minutes as number
 * @returns Formatted duration string (e.g., "1w 2d 4h 30m") or empty string if 0/null
 */
export function minutesToDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes === 0) return ''

  let remaining = Math.abs(Math.round(minutes))
  const parts: string[] = []

  const weeks = Math.floor(remaining / MINUTES_PER_WEEK)
  if (weeks > 0) {
    parts.push(`${weeks}w`)
    remaining -= weeks * MINUTES_PER_WEEK
  }

  const days = Math.floor(remaining / MINUTES_PER_DAY)
  if (days > 0) {
    parts.push(`${days}d`)
    remaining -= days * MINUTES_PER_DAY
  }

  const hours = Math.floor(remaining / MINUTES_PER_HOUR)
  if (hours > 0) {
    parts.push(`${hours}h`)
    remaining -= hours * MINUTES_PER_HOUR
  }

  if (remaining > 0) {
    parts.push(`${remaining}m`)
  }

  const result = parts.join(' ')
  return minutes < 0 ? `-${result}` : result
}

/**
 * Converts JIRA-style duration string to minutes (numeric)
 * Supports: w (weeks=40h), d (days=8h), h (hours), m (minutes)
 * @param duration - Duration string (e.g., "2w 3d 4h 15m" or "2w3d4h15m")
 * @returns Total minutes as number, or null if invalid format
 */
export function durationToMinutes(duration: string | null | undefined): number | null {
  if (!duration || typeof duration !== 'string') return null

  const trimmed = duration.trim()
  if (trimmed === '') return null

  // Check for negative duration
  const isNegative = trimmed.startsWith('-')
  const input = isNegative ? trimmed.slice(1) : trimmed

  // Match patterns like "2w", "3d", "4h", "15m" with optional spaces
  const pattern = /^\s*(\d+w)?\s*(\d+d)?\s*(\d+h)?\s*(\d+m)?\s*$/i
  const match = input.match(pattern)

  if (!match) return null

  // If nothing matched (all groups undefined), invalid
  if (!match[1] && !match[2] && !match[3] && !match[4]) return null

  let totalMinutes = 0

  if (match[1]) {
    totalMinutes += parseInt(match[1]) * MINUTES_PER_WEEK
  }
  if (match[2]) {
    totalMinutes += parseInt(match[2]) * MINUTES_PER_DAY
  }
  if (match[3]) {
    totalMinutes += parseInt(match[3]) * MINUTES_PER_HOUR
  }
  if (match[4]) {
    totalMinutes += parseInt(match[4])
  }

  return isNegative ? -totalMinutes : totalMinutes
}

/**
 * Validates a JIRA-style duration string
 * @param duration - Duration string to validate
 * @returns true if valid format, false otherwise
 */
export function isValidDuration(duration: string | null | undefined): boolean {
  if (!duration || typeof duration !== 'string') return true // empty is valid
  return durationToMinutes(duration) !== null
}
