import { h, type Component } from 'vue'

export type OvGeoJsonGeometry = {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon'
  coordinates: number[] | number[][] | number[][][] | number[][][][]
}

export type OvGeoJsonFeature = {
  type: 'Feature'
  geometry: OvGeoJsonGeometry
  properties?: Record<string, unknown>
}

export type OvGeoJson = {
  type: 'FeatureCollection'
  features: OvGeoJsonFeature[]
}

export type OvMapOptions = {
  center?: [number, number]
  zoom?: number
  height?: string
  width?: string
  tileUrl?: string
  tileAttribution?: string
  autoFit?: boolean
  fitPadding?: number
  maxFitZoom?: number
  iconUrl?: string
  iconSize?: [number, number]
  iconAnchor?: [number, number]
  popupAnchor?: [number, number]
}

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
  tsFormat?: string
}

export type OvAction =
  | {
      key?: string
      name: string
      title?: string
      format?: OvFormat | OvFormat[]
      form?: OvFormOptions
      group?: boolean
    }
  | string

type OvFormFieldBase = {
  type:
    | 'text'
    | 'email'
    | 'password'
    | 'textarea'
    | 'markdown'
    | 'custom'
    | 'number'
    | 'switch'
    | 'rating'
    | 'checkbox'
    | 'select'
    | 'combobox'
    | 'autocomplete'
    | 'file'
    | 'color'
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

export type ImageUrlResult = {
  displayUrl: string
  storageUrl: string
}

export type OvFormMarkdownField = OvFormFieldBase & {
  type: 'markdown'
  toolbar?: string[]
  toolbarClass?: string
  editorClass?: string
  minHeight?: string
  maxHeight?: string
  imageUploader?: (base64Data: string) => Promise<string | null>
  imageUrlResolver?: (imageId: string) => Promise<ImageUrlResult>
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
  format?: { value?: string }
  chips?: boolean
  multiple?: boolean
}

export type OvFormFileField = OvFormFieldBase & {
  type: 'file'
  multiple?: boolean
  accept?: string
}

export type OvFormColorField = OvFormFieldBase & {
  type: 'color'
  showAlpha?: boolean
  swatches?: string[][]
  modes?: string[]
}

export type OvFormCustomField = OvFormFieldBase & {
  type: 'custom'
  component?: unknown
  props?: Record<string, unknown>
}

export type OvFormFileData = {
  name: string
  type: string
  size: number
  content: string
}

export async function fileToBase64(file: File): Promise<OvFormFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const base64 = (reader.result as string).split(',')[1] || ''
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        content: base64,
      })
    })
    reader.addEventListener('error', () => reject())
    reader.readAsDataURL(file)
  })
}

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
  | OvFormColorField
  | OvFormCustomField
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
  singleSort?: boolean
  actions?: OvAction[]
  actionFormat?: OvFormat | OvFormat[]
  itemsPerPage?: number
  mobileItemsPerPage?: number
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
  t?: (key: string) => string
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
    required: () => (value !== null && value !== undefined && value !== '') || message || false,
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
    email: () => /^[\w.-]+@([\w-]+\.)+[\w-]{2,}$/.test(value as string) || message || false,
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
      (rule) => OvRuleValidate(value, rule?.type, rule?.params, rule?.message) === true,
    )
    if (isValid) return fmt
  }
  return {}
}

export const OvTextAlign = (align: 'left' | 'center' | 'right' | undefined) =>
  align ? `text-${align}` : ''

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
    }).filter(([, entryValue]) => entryValue !== undefined),
  )
}

export const OvActionFormat = (
  value: unknown,
  action: OvAction,
  actionFormat?: OvFormat | OvFormat[],
  t?: (key: string) => string,
) => {
  if (typeof action === 'string') return { name: action, text: action }
  const fmt = OvFieldFormat(value, action.format)
  const actionFmt = OvFieldFormat(value, actionFormat)
  fmt.text = fmt.icon ? undefined : fmt.text || action.name
  fmt.name = action.name
  fmt.title = action.title ? (t ? t(action.title) : action.title) : undefined
  return { ...actionFmt, ...fmt }
}

import { VLabel, VIcon, VChip, VBtn, VMenu, VList, VListItem } from 'vuetify/components'

export function sanitizeHtml(raw: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/html')
  doc
    .querySelectorAll('script,style,iframe,object,embed,form,link,base,meta')
    .forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (
        attr.name.startsWith('on') ||
        (attr.name === 'href' && attr.value.trimStart().toLowerCase().startsWith('javascript:'))
      )
        el.removeAttribute(attr.name)
    }
  })
  return doc.body?.innerHTML ?? ''
}

function replaceTemplateValue(
  template: string,
  value: unknown,
  data?: Record<string, unknown>,
): string {
  let result = template

  // Replace {{value.fieldName}} patterns
  const fieldPattern = /\{\{value\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g
  result = result.replace(fieldPattern, (match, fieldName) => {
    const fieldValue = data?.[fieldName]
    return fieldValue != null ? String(fieldValue) : match
  })

  // Replace {{value}} placeholder
  result = result.replace('{{value}}', String(value ?? ''))

  return result
}

export const renderViewItem = (
  value: unknown,
  item?: OvViewItem,
  data?: OvViewData,
  options?: OvViewOptions,
  onEmit?: (event: string, ...args: unknown[]) => void,
) => {
  return () => {
    let displayValue = value

    // Apply tsFormat if provided
    const format = Array.isArray(item?.format) ? item?.format[0] : item?.format
    if (format?.tsFormat) {
      try {
        // Support date formatting with Intl API
        if (displayValue instanceof Date || typeof displayValue === 'string') {
          const date =
            typeof displayValue === 'string' ? new Date(displayValue as string) : displayValue
          const hasTime =
            format.tsFormat.includes('HH') ||
            format.tsFormat.includes('mm') ||
            format.tsFormat.includes('ss')
          const hasDate =
            format.tsFormat.includes('yyyy') ||
            format.tsFormat.includes('MM') ||
            format.tsFormat.includes('dd')

          let formatted = ''
          if (hasDate) {
            formatted = date
              .toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              })
              .split('/')
              .toReversed()
              .join('-')
          }
          if (hasTime) {
            const time = date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })
            formatted = formatted ? `${formatted} ${time}` : time
          }
          if (formatted) displayValue = formatted
        }
      } catch (e) {
        // Silently fail and use original value
        console.debug('Format error:', e)
      }
    }

    if (typeof displayValue === 'object' && displayValue !== null) {
      displayValue = JSON.stringify(displayValue, null, 2)
    }

    const valueStr = String(displayValue ?? '')
    const valueDsp = valueStr.slice(0, item?.maxLength ?? options?.maxLength ?? 32767)
    const isTrimmed = item?.maxLength === 0 || valueStr.length > valueDsp.length
    const chipProps = OvFieldFormat(valueStr, item?.format)

    // Apply template replacement to icon if it contains placeholders
    if (chipProps.icon && typeof chipProps.icon === 'string') {
      chipProps.icon = replaceTemplateValue(chipProps.icon, valueStr, data)
    }

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
        children.push(h('div', { innerHTML: sanitizeHtml(valueStr) }))
      } else {
        // Determine default slot content: use format.text if explicitly provided, otherwise use value
        const hasExplicitText = 'text' in chipProps
        const slotContent = hasExplicitText ? (chipProps.text ?? '') : valueDsp

        const slots: Record<string, () => unknown> = {
          default: () => slotContent,
        }

        if (chipProps.href && typeof chipProps.href === 'string') {
          chipProps.href = replaceTemplateValue(chipProps.href, valueStr, data)
        }

        if (chipProps.to && typeof chipProps.to === 'string') {
          chipProps.to = replaceTemplateValue(chipProps.to, valueStr, data)
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

    const regularActions: OvAction[] = []
    const groupedActions: OvAction[] = []

    item?.actions?.forEach((action) => {
      const actionObj = typeof action === 'string' ? { name: action } : action
      if (actionObj.group) {
        groupedActions.push(action)
      } else {
        regularActions.push(action)
      }
    })

    const renderAction = (action: OvAction) => {
      const actionObj = typeof action === 'string' ? { name: action } : action
      const actionVal = actionObj.key ? (data ?? {})[actionObj.key] : value
      const props = OvActionFormat(actionVal, actionObj, options?.actionFormat, options?.t)

      if ((props as Record<string, unknown>).to && actionObj.key) {
        ;(props as Record<string, unknown>).to = replaceTemplateValue(
          (props as Record<string, unknown>).to as string,
          (data ?? {})[actionObj.key],
          data,
        )
      }

      // Apply template replacement to icon if it contains placeholders
      if (
        (props as Record<string, unknown>).icon &&
        typeof (props as Record<string, unknown>).icon === 'string'
      ) {
        ;(props as Record<string, unknown>).icon = replaceTemplateValue(
          (props as Record<string, unknown>).icon as string,
          actionVal,
          data,
        )
      }

      const hidden = (props as Record<string, unknown>)['hidden'] === true
      const isNavigationAction =
        !!(props as Record<string, unknown>).to || !!(props as Record<string, unknown>).href

      if (!hidden) {
        return { actionObj, props, isNavigationAction, hidden: false }
      }
      return { actionObj, props, isNavigationAction, hidden: true }
    }

    regularActions.forEach((action) => {
      const result = renderAction(action)
      if (!result.hidden) {
        children.push(
          h(VBtn, {
            ...result.props,
            ...(result.isNavigationAction
              ? {}
              : {
                  onClick: () => onEmit?.('action', result.actionObj.name, valueStr),
                }),
          }),
        )
      }
    })

    if (groupedActions.length > 0) {
      const menuItems = groupedActions
        .map((action) => renderAction(action))
        .filter((r) => !r.hidden)

      if (menuItems.length > 0) {
        children.push(
          h(
            VBtn,
            {
              variant: 'text',
              size: 'small',
              icon: '$mdiDotsVertical',
            },
            {
              default: () => [
                h(VIcon, { icon: '$mdiDotsVertical' }),
                h(
                  VMenu,
                  { activator: 'parent' },
                  {
                    default: () => [
                      h(
                        VList,
                        { density: 'compact' },
                        {
                          default: () =>
                            menuItems.map((mi) => {
                              const p = mi.props as Record<string, unknown>
                              return h(VListItem as Component, {
                                ...(p.icon ? { prependIcon: p.icon as string } : {}),
                                title: (p.text as string) || mi.actionObj.name,
                                ...(p.title ? { title: p.title as string } : {}),
                                ...(mi.isNavigationAction
                                  ? { to: p.to, href: p.href, target: p.target }
                                  : {
                                      onClick: () =>
                                        onEmit?.('action', mi.actionObj.name, valueStr),
                                    }),
                                link: true,
                              })
                            }),
                        },
                      ),
                    ],
                  },
                ),
              ],
            },
          ),
        )
      }
    }

    return h('span', {}, children)
  }
}

export function camelToKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

export function transformKeysToKebabCase(obj: OvFormData): OvFormData {
  const result: OvFormData = {}
  for (const [key, value] of Object.entries(obj)) {
    result[camelToKebabCase(key)] = value
  }
  return result
}

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 8
const HOURS_PER_WEEK = 40
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR
const MINUTES_PER_WEEK = HOURS_PER_WEEK * MINUTES_PER_HOUR

export function minutesToDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes === 0) return ''

  let remaining = Math.abs(Math.round(Number(minutes)))
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
  return minutes && Number(minutes) < 0 ? `-${result}` : result
}

export function durationToMinutes(duration: string | null | undefined): number | null {
  if (!duration || typeof duration !== 'string') return null

  const trimmed = duration.trim()
  if (trimmed === '') return null

  const isNegative = trimmed.startsWith('-')
  const input = isNegative ? trimmed.slice(1) : trimmed

  const pattern = /^\s*(\d+w)?\s*(\d+d)?\s*(\d+h)?\s*(\d+m)?\s*$/i
  const match = input.match(pattern)

  if (!match) return null

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

export function isValidDuration(duration: string | null | undefined): boolean {
  if (!duration || typeof duration !== 'string') return true
  return durationToMinutes(duration) !== null
}
