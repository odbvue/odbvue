import { odbType } from '../../schema/package.js'
import { ID_LENGTH, VALUE_LENGTH } from './constants.js'

export type SettingMeta = Record<string, unknown>

/** Parameter types for settings values, without referring to `odb_settings_store`. */
export const settingsTypes = {
  id: odbType.string(ID_LENGTH),
  value: odbType.string(VALUE_LENGTH),
  meta: odbType.json(),
}
