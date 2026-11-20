import { odbType } from '../../schema/package.js'
import { ID_LENGTH, VALUE_LENGTH } from './constants.js'
import type { ValidationRule } from '../validation/types.js'

export type SettingRule =
  | ValidationRule
  | {
      type: 'custom'
      params: 'jwt-secret' | 'jwt-issuer' | 'jwt-expiration' | 'port'
      message?: string
    }

export type SettingMeta = Record<string, unknown> & {
  secret?: 'Y' | 'N'
  readonly?: 'Y' | 'N'
  type?:
    | 'string'
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
  label?: string
  rules?: SettingRule[]
  items?: string[]
}

/** Parameter types for settings values, without referring to `odb_settings_store`. */
export const settingsTypes = {
  id: odbType.string(ID_LENGTH),
  value: odbType.string(VALUE_LENGTH),
  meta: odbType.json(),
}
