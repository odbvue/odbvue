import { minutesToDuration } from '../api.js'
import type { OvFormData } from '../api.js'

export type BooleanFormat = 'boolean' | 'Y/N' | 'T/F' | 'true/false' | '0/1' | '0/1-string'

export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return ['y', 't', 'true', '1'].includes(value.toLowerCase())
  if (typeof value === 'number') return value !== 0
  return Boolean(value)
}

export function detectSwitchFormat(value: unknown): BooleanFormat {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'y' || lower === 'n') return 'Y/N'
    if (lower === 't' || lower === 'f') return 'T/F'
    if (lower === 'true' || lower === 'false') return 'true/false'
    if (lower === '0' || lower === '1') return '0/1-string'
  }
  if (value === 0 || value === 1) return '0/1'
  return 'Y/N'
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
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      switchFieldFormats[fieldName] = detectSwitchFormat(value)
      values[fieldName] = toBoolean(value)
    }
  }

  return { values, switchFieldFormats }
}
