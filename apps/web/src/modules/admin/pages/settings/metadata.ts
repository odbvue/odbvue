import { OvRuleValidate, type OvFormOptions, type OvRule } from '@/components/api'

type Field = OvFormOptions['fields'][number]
type SettingType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'number'
  | 'switch'
  | 'checkbox'
  | 'select'
  | 'combobox'
  | 'autocomplete'
  | 'email'
  | 'password'
  | 'color'
  | 'date'
  | 'time'
  | 'datetime'

const types = new Set<SettingType>([
  'text',
  'textarea',
  'markdown',
  'number',
  'switch',
  'checkbox',
  'select',
  'combobox',
  'autocomplete',
  'email',
  'password',
  'color',
  'date',
  'time',
  'datetime',
])
const customRules: Record<string, (value: string) => boolean> = {
  'jwt-secret': (value) => /^[0-9A-Fa-f]{64}$/.test(value),
  'jwt-issuer': (value) => /^[!-~]{1,255}$/.test(value),
  'jwt-expiration': (value) =>
    /^[0-9]{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= 86400,
  port: (value) => /^[0-9]{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= 65535,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function decimalParts(text: string) {
  const match = /^([+-]?)([0-9]+)(?:\.([0-9]+))?(?:e([+-]?[0-9]+))?$/i.exec(text)!
  const fraction = match[3] ?? ''
  return {
    coefficient: BigInt(`${match[1]}${match[2]}${fraction}`),
    scale: fraction.length - Number(match[4] ?? 0),
  }
}

function compareDecimal(value: string, parameter: number): number {
  const left = decimalParts(value)
  const right = decimalParts(String(parameter))
  const scale = Math.max(left.scale, right.scale)
  const a = left.coefficient * 10n ** BigInt(scale - left.scale)
  const b = right.coefficient * 10n ** BigInt(scale - right.scale)
  return a < b ? -1 : a > b ? 1 : 0
}

function parseRule(rule: unknown, isSwitch: boolean): OvRule {
  if (!isRecord(rule) || typeof rule.type !== 'string')
    throw new Error('admin.settingMetadataError')
  if (rule.message !== undefined && typeof rule.message !== 'string')
    throw new Error('admin.settingMetadataError')
  const { type, params } = rule
  const message = typeof rule.message === 'string' ? rule.message : 'admin.settingValidationError'
  let valid = false
  if (type === 'required') valid = params === undefined || typeof params === 'boolean'
  if (type === 'min-length' || type === 'max-length')
    valid = Number.isSafeInteger(params) && Number(params) >= 0
  if (type === 'equals' || type === 'equals-not') valid = typeof params === 'string'
  if (type === 'greater-than' || type === 'less-than')
    valid = typeof params === 'number' && Number.isFinite(params)
  if (type === 'in-range')
    valid =
      Array.isArray(params) &&
      params.length === 2 &&
      params.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
      params[0] <= params[1]
  if (type === 'set')
    valid = Array.isArray(params) && params.every((item) => typeof item === 'string')
  if (type === 'custom') valid = typeof params === 'string' && Object.hasOwn(customRules, params)
  if (!valid) throw new Error('admin.settingMetadataError')
  const convert = (value: unknown) =>
    isSwitch && typeof value === 'boolean' ? (value ? 'Y' : 'N') : (value ?? '')
  if (type === 'custom') {
    const validator = customRules[String(params)]!
    return {
      type: 'custom',
      params: (value: unknown) =>
        typeof convert(value) === 'string' && validator(String(convert(value))),
      message,
    }
  }
  return {
    type: 'custom',
    params: (value: unknown) => {
      const normalized = convert(value)
      if (['greater-than', 'less-than', 'in-range'].includes(type)) {
        if (
          typeof normalized !== 'string' ||
          !/^[+-]?[0-9]{1,15}([.][0-9]{1,10})?$/.test(normalized)
        )
          return false
        if (type === 'greater-than') return compareDecimal(normalized, Number(params)) > 0
        if (type === 'less-than') return compareDecimal(normalized, Number(params)) < 0
        if (Array.isArray(params))
          return (
            compareDecimal(normalized, params[0]) >= 0 && compareDecimal(normalized, params[1]) <= 0
          )
      }
      return OvRuleValidate(normalized, type, params) === true
    },
    message,
  }
}

export function settingField(meta: unknown, secret: boolean): Field {
  if (!isRecord(meta)) throw new Error('admin.settingMetadataError')
  const rawType = meta.type === undefined ? 'text' : meta.type
  const type = rawType === 'string' ? 'text' : rawType
  if (typeof type !== 'string' || !types.has(type as SettingType))
    throw new Error('admin.settingMetadataError')
  if (meta.rules !== undefined && (!Array.isArray(meta.rules) || meta.rules.length > 32))
    throw new Error('admin.settingMetadataError')
  if (
    type === 'select' &&
    (!Array.isArray(meta.items) || !meta.items.every((item) => typeof item === 'string'))
  )
    throw new Error('admin.settingMetadataError')
  if (
    (type === 'combobox' || type === 'autocomplete') &&
    meta.items !== undefined &&
    (!Array.isArray(meta.items) || !meta.items.every((item) => typeof item === 'string'))
  )
    throw new Error('admin.settingMetadataError')
  const rules = Array.isArray(meta.rules)
    ? meta.rules.map((rule) => parseRule(rule, type === 'switch' || type === 'checkbox'))
    : []
  if (type === 'select' && Array.isArray(meta.items)) {
    const items: unknown[] = meta.items
    rules.unshift({
      type: 'custom',
      params: (value: unknown) => items.includes(value ?? ''),
      message: 'admin.settingValidationError',
    })
  }
  if (type === 'switch' || type === 'checkbox')
    rules.unshift({
      type: 'custom',
      params: (value: unknown) => typeof value === 'boolean' || value === 'Y' || value === 'N',
      message: 'admin.settingValidationError',
    })
  if (type === 'number')
    rules.unshift({
      type: 'custom',
      params: (value: unknown) =>
        value == null ||
        value === '' ||
        (typeof value === 'string' && /^[+-]?[0-9]{1,15}([.][0-9]{1,10})?$/.test(value)),
      message: 'admin.settingValidationError',
    })
  if (secret)
    rules.unshift(
      { type: 'required', params: true, message: 'admin.settingSecretRequired' },
      { type: 'equals-not', params: '********', message: 'admin.settingSecretRequired' },
    )
  rules.push({
    type: 'custom',
    params: (value: unknown) => value == null || typeof value !== 'string' || value.length <= 2000,
    message: 'admin.settingTooLong',
  })
  return {
    name: secret ? 'replacement' : 'value',
    type: secret ? 'password' : (type as SettingType),
    label: secret ? 'admin.settingReplacement' : 'admin.settingValue',
    ...(secret ? { value: '', hint: 'admin.settingSecretHint', autocomplete: 'new-password' } : {}),
    ...(['select', 'combobox', 'autocomplete'].includes(type) &&
    !secret &&
    Array.isArray(meta.items)
      ? { items: meta.items }
      : {}),
    rules,
  } as Field
}
