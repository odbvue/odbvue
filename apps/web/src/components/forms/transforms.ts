import { minutesToDuration } from '../api.js'
import type { OvFormData } from '../api.js'

export type BooleanFormat = 'boolean' | 'Y/N' | 'T/F' | 'true/false' | '0/1' | '0/1-string'

export function toBoolean(value: unknown): boolean {
  detectSwitchFormat(value)
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return ['y', 't', 'true', '1'].includes(value.toLowerCase())
  return value === 1
}

export function detectSwitchFormat(value: unknown, fieldName?: string): BooleanFormat {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'y' || lower === 'n') return 'Y/N'
    if (lower === 't' || lower === 'f') return 'T/F'
    if (lower === 'true' || lower === 'false') return 'true/false'
    if (lower === '0' || lower === '1') return '0/1-string'
  }
  if (value === 0 || value === 1) return '0/1'
  throw new TypeError(
    fieldName === undefined
      ? 'Unsupported switch or checkbox value'
      : `Unsupported switch or checkbox value for field "${fieldName}"`,
  )
}

export function transformFormData(
  data: OvFormData,
  durationFields: string[],
  switchFields: string[],
): { values: OvFormData; switchFieldFormats: Record<string, BooleanFormat> } {
  const values = { ...data }
  const switchFieldFormats: Record<string, BooleanFormat> = {}

  for (const fieldName of durationFields) {
    if (typeof values[fieldName] === 'number')
      values[fieldName] = minutesToDuration(values[fieldName])
  }

  for (const fieldName of switchFields) {
    const value = values[fieldName]
    if (value !== undefined && value !== null) {
      switchFieldFormats[fieldName] = detectSwitchFormat(value, fieldName)
      values[fieldName] = toBoolean(value)
    }
  }

  return { values, switchFieldFormats }
}
