// Settings capability: `odb_settings_store` table and the `odb_settings` PL/SQL package,
// both defined in TypeScript. The package owns the CRUD logic and raises transport-independent
// ODB errors; ORDS exposure, HTTP status mapping and authorization belong to the application package.

import type { PlsqlRenderable } from '../../schema/attribute.js'
import { plsqlBlock, qualify } from '../../schema/ddl.js'
import { PACKAGE_NAME } from './constants.js'
import { odbSettingsPackage } from './package.js'
import { settingsStore } from './tables.js'
import { settingsTypes, type SettingMeta } from './types.js'

export { odbSettingsPackage } from './package.js'
export { settingsStore } from './tables.js'
export type { SettingMeta } from './types.js'

function lit(text: string): string {
  return `'${text.replace(/'/g, "''")}'`
}

/** Installable settings capability plus typed calls into `odb_settings`. */
export const odbSettings = {
  toSQLUp(options: { schema?: string } = {}): string {
    return [settingsStore.toSQLUp(options), odbSettingsPackage.toSQLUp(options)].join('\n')
  },

  toSQLDown(options: { schema?: string } = {}): string {
    return [odbSettingsPackage.toSQLDown(options), settingsStore.toSQLDown(options)].join('\n')
  },

  /** Parameter types for declaring procedures that pass settings through, without knowing the table. */
  types: settingsTypes,

  /** `odb_settings.list(<after>, <limit>, <items>)`; a `NULL` limit returns up to 50 settings. */
  list(after: PlsqlRenderable, limit: PlsqlRenderable, items: PlsqlRenderable) {
    return odbSettingsPackage.list(after, limit, items)
  },

  /** `odb_settings.read(<id>, <value>, <meta>)` with OUT `value` and `meta`. */
  read(id: PlsqlRenderable, value: PlsqlRenderable, meta: PlsqlRenderable) {
    return odbSettingsPackage.read(id, value, meta)
  },

  /** `odb_settings.write(<id>, <value>, <meta>)`; the default `NULL` meta keeps existing metadata. */
  write(id: PlsqlRenderable, value: PlsqlRenderable, meta: PlsqlRenderable = 'NULL') {
    return odbSettingsPackage.write(id, value, meta)
  },

  /** `odb_settings.remove(<id>)`. */
  remove(id: PlsqlRenderable) {
    return odbSettingsPackage.remove(id)
  },

  /**
   * Migration artifact that upserts settings through `odb_settings.write` and removes
   * them on rollback. Install it after `odbSettings`.
   */
  seed(...settings: Array<{ id: string; value: string; meta?: SettingMeta }>) {
    if (settings.length === 0)
      throw new Error('odbSettings.seed(): at least one setting is required.')
    return {
      toSQLUp({ schema }: { schema?: string } = {}): string {
        const pkg = qualify(PACKAGE_NAME, schema)
        return settings
          .map((s) =>
            plsqlBlock(
              `${pkg}.write(${lit(s.id)}, ${lit(s.value)}, ${s.meta ? lit(JSON.stringify(s.meta)) : 'NULL'})`,
            ),
          )
          .join('\n')
      },
      toSQLDown({ schema }: { schema?: string } = {}): string {
        const pkg = qualify(PACKAGE_NAME, schema)
        return settings
          .toReversed()
          .map((s) => plsqlBlock(`${pkg}.remove(${lit(s.id)})`))
          .join('\n')
      },
    }
  },
}
