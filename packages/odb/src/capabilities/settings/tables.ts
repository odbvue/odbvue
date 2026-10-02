import { odbTable } from '../../schema/table.js'
import { ID_LENGTH, VALUE_LENGTH } from './constants.js'
import type { SettingMeta } from './types.js'

export const settingsStore = odbTable('odb_settings_store', (t) => ({
  id: t.string(ID_LENGTH).primaryKey(),
  value: t.string(VALUE_LENGTH),
  meta: t.json<SettingMeta>().notNull().default({}),
})).comment('Application settings')
