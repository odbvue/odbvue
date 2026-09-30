// Settings capability: `odb_settings_store` table and the `odb_settings` PL/SQL package,
// both defined in TypeScript. The package owns the CRUD logic and raises transport-independent
// ODB errors; ORDS exposure, HTTP status mapping and authorization belong to the application package.

import { cond, odbLiteral, plsqlExpr, type PlsqlRenderable } from '../../schema/attribute.js'
import { plsqlBlock, qualify } from '../../schema/ddl.js'
import { odbPackage, odbType } from '../../schema/package.js'
import { odbTable } from '../../schema/table.js'
import { odbQuery } from '../../query/index.js'

const PACKAGE_NAME = 'odb_settings'
const DEFAULT_LIMIT = 50

export type SettingMeta = Record<string, unknown>

export const settingsStore = odbTable('odb_settings_store', (t) => ({
  id: t.string(128).primaryKey(),
  value: t.string(2000),
  meta: t.string(2000).notNull().default('{}'),
})).comment('Application settings')

function lit(text: string): string {
  return `'${text.replace(/'/g, "''")}'`
}

/** PL/SQL API for the settings store. Callers own authorization and transactions. */
export const odbSettingsPackage = odbPackage(PACKAGE_NAME, (pkg) => {
  /** Settings ordered by id after `after` (null for the start); `limit` null means the default page size. */
  const list = pkg.proc(
    'list',
    {
      in: { after: settingsStore.id, limit: odbType.integer() },
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, items }, body }) => {
      body.openFor(
        items,
        odbQuery()
          .selectFrom(settingsStore)
          .select([settingsStore.id, settingsStore.value, settingsStore.meta])
          .where(cond.or([cond.isNull(after), cond.gt(settingsStore.id, after)]))
          .orderBy(settingsStore.id)
          .limit(plsqlExpr.call('PLS_INTEGER', 'NVL', limit, odbLiteral(DEFAULT_LIMIT))),
      )
    },
  )

  /** Reads one setting; raises a NOT_FOUND ODB error when it does not exist. */
  const read = pkg.proc(
    'read',
    {
      in: { id: settingsStore.id },
      out: { value: settingsStore.value, meta: settingsStore.meta },
    },
    ({ params: { id, value, meta }, body }) => {
      body.query(
        odbQuery()
          .selectFrom(settingsStore)
          .select([settingsStore.value, settingsStore.meta])
          .into(value, meta)
          .where(cond.eq(settingsStore.id, id)),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.notFound())
    },
  )

  /** Creates or updates a setting; a null `meta` keeps the existing metadata (or `{}` on create). */
  const write = pkg.proc(
    'write',
    { in: { id: settingsStore.id, value: settingsStore.value, meta: settingsStore.meta } },
    ({ params: { id, value, meta }, body }) => {
      const target = settingsStore.as('target')
      const merge = odbQuery().mergeInto(target).using({ id, value, meta }, 'source')
      const sourceId = merge.sourceRef('id')
      const sourceValue = merge.sourceRef('value')
      const sourceMeta = merge.sourceRef('meta')
      body.query(
        merge
          .on((t, source) => cond.eq(t.id, source.id))
          .whenMatched({
            value: sourceValue,
            meta: plsqlExpr.call('VARCHAR2', 'NVL', sourceMeta, target.meta),
          })
          .whenNotMatched({
            id: sourceId,
            value: sourceValue,
            meta: plsqlExpr.call('VARCHAR2', 'NVL', sourceMeta, odbLiteral('{}')),
          }),
      )
    },
  )

  const remove = pkg.proc(
    'remove',
    { in: { id: settingsStore.id } },
    ({ params: { id }, body }) => {
      body.query(odbQuery().deleteFrom(settingsStore).where(cond.eq(settingsStore.id, id)))
    },
  )

  return { list, read, write, remove }
})

/** Installable settings capability plus typed calls into `odb_settings`. */
export const odbSettings = {
  toSQLUp(options: { schema?: string } = {}): string {
    return [settingsStore.toSQLUp(options), odbSettingsPackage.toSQLUp(options)].join('\n')
  },

  toSQLDown(options: { schema?: string } = {}): string {
    return [odbSettingsPackage.toSQLDown(options), settingsStore.toSQLDown(options)].join('\n')
  },

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
