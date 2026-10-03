import { cond, odbLiteral, plsqlExpr } from '../../schema/attribute.js'
import { odbPackage, odbType } from '../../schema/package.js'
import { odbQuery } from '../../query/index.js'
import { DEFAULT_LIMIT, PACKAGE_NAME } from './constants.js'
import { settingsStore } from './tables.js'

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
            meta: plsqlExpr.call('CLOB', 'NVL', sourceMeta, target.meta),
          })
          .whenNotMatched({
            id: sourceId,
            value: sourceValue,
            meta: plsqlExpr.call('CLOB', 'NVL', sourceMeta, odbLiteral('{}')),
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
