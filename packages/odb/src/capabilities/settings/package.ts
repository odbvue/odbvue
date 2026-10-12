import { cond, odbLiteral, PlsqlExpression } from '../../schema/attribute.js'
import { odbPackage, odbType } from '../../schema/package.js'
import { odbQuery } from '../../query/index.js'
import { DEFAULT_LIMIT, PACKAGE_NAME } from './constants.js'
import { settingsStore } from './tables.js'
import { settingsTypes } from './types.js'
import { settingsEncryption } from './encryption.js'
import { odbDbmsLob, odbOracle } from '../../oracle/index.js'
import { VALUE_LENGTH } from './constants.js'

/** PL/SQL API for the settings store. Callers own authorization and transactions. */
export const odbSettingsPackage = odbPackage(PACKAGE_NAME, (pkg) => {
  const { encrypt, decrypt } = settingsEncryption(pkg)
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
          .select(settingsStore.id)
          .selectAs(
            odbOracle.caseWhen(
              cond.eq(settingsStore.secret, 'Y'),
              odbOracle.toClob(odbLiteral('********')),
              settingsStore.value,
              'CLOB',
            ),
            settingsStore.value,
          )
          .select(settingsStore.meta)
          .where(cond.or([cond.isNull(after), cond.gt(settingsStore.id, after)]))
          .orderBy(settingsStore.id)
          .limit(odbOracle.nvl(limit, odbLiteral(DEFAULT_LIMIT))),
      )
    },
  )

  /** Reads one setting; raises a NOT_FOUND ODB error when it does not exist. */
  const readValue = pkg.privateProc('read_value', (proc) => {
    const { id, value, meta, masked } = proc.parameters({
      in: { id: settingsStore.id, masked: odbType.integer() },
      out: { value: settingsTypes.value, meta: settingsStore.meta },
    })
    proc.body((body) => {
      const { storedValue, secret } = body.variables({
        storedValue: odbType.clob(),
        secret: odbType.string(1),
      })
      body.query(
        odbQuery()
          .selectFrom(settingsStore)
          .select([settingsStore.value, settingsStore.meta, settingsStore.secret])
          .into(storedValue, meta, secret)
          .where(cond.eq(settingsStore.id, id)),
      )
      body.ifThen(
        cond.eq(secret, 'Y'),
        (then) => {
          then.ifThen(
            cond.eq(masked, 1),
            (presentation) => presentation.set(value, odbLiteral('********')),
            (plain) => plain.set(value, decrypt.invoke(id, storedValue)),
          )
        },
        (plain) => plain.set(value, odbDbmsLob.substr(storedValue, VALUE_LENGTH, 1)),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.notFound())
    })
  })

  const readParameters = {
    in: { id: settingsStore.id },
    out: { value: settingsTypes.value, meta: settingsStore.meta },
  }
  const read = pkg.proc('read', readParameters, ({ params: { id, value, meta }, body }) =>
    body.call(readValue.invoke(id, '0', value, meta)),
  )
  const readMasked = pkg.proc(
    'read_masked',
    readParameters,
    ({ params: { id, value, meta }, body }) => body.call(readValue.invoke(id, '1', value, meta)),
  )

  /** Creates or updates a setting; a null `meta` keeps the existing metadata (or `{}` on create). */
  const write = pkg.proc(
    'write',
    { in: { id: settingsStore.id, value: settingsTypes.value, meta: settingsStore.meta } },
    ({ params: { id, value, meta }, body }) => {
      const { effectiveMeta, storedValue, secret } = body.variables({
        effectiveMeta: settingsStore.meta,
        storedValue: odbType.clob(),
        secret: odbType.string(10),
      })
      body.ifThen(cond.gt(odbOracle.length(value), VALUE_LENGTH), (invalid) =>
        invalid.invalid('SETTINGS_VALUE_TOO_LONG'),
      )
      body.block((existing) => {
        existing.query(
          odbQuery()
            .selectFrom(settingsStore)
            .select(settingsStore.meta)
            .into(effectiveMeta)
            .where(cond.eq(settingsStore.id, id))
            .forUpdate(),
        )
        existing.when('NO_DATA_FOUND', (missing) => missing.set(effectiveMeta, odbLiteral('{}')))
      })
      body.set(effectiveMeta, odbOracle.nvl(meta, effectiveMeta))
      body.ifThen(cond.not(cond.isJson(effectiveMeta)), (invalid) =>
        invalid.invalid('SETTINGS_META_INVALID'),
      )
      body.set(
        secret,
        odbOracle.nvl(
          odbOracle.jsonValue(effectiveMeta, odbLiteral('$.secret'), {
            length: 10,
            errorOnError: true,
            nullOnEmpty: true,
          }),
          odbLiteral('N'),
        ),
      )
      body.ifThen(cond.not(cond.or([cond.eq(secret, 'Y'), cond.eq(secret, 'N')])), (invalid) =>
        invalid.invalid('SETTINGS_SECRET_INVALID'),
      )
      // SMTP_PASSWORD remains a secret even if removed and recreated through the generic API.
      body.ifThen(cond.eq(id, 'SMTP_PASSWORD'), (then) => {
        then.set(secret, odbLiteral('Y'))
        then.query(
          odbQuery()
            .selectFrom('dual')
            .select(odbOracle.jsonMergePatch(effectiveMeta, odbLiteral('{"secret":"Y"}')))
            .into(effectiveMeta),
        )
      })
      body.ifThen(
        cond.eq(secret, 'Y'),
        (then) => {
          then.ifThen(cond.eq(value, '********'), (invalid) =>
            invalid.invalid('SETTINGS_SECRET_MASKED_VALUE'),
          )
          then.set(storedValue, encrypt.invoke(id, value))
        },
        (plain) => plain.set(storedValue, odbOracle.toClob(value)),
      )
      const target = settingsStore.as('target')
      const merge = odbQuery()
        .mergeInto(target)
        .using({ id, value: storedValue, meta: effectiveMeta }, 'source')
      const sourceId = merge.sourceRef('id')
      const sourceValue = merge.sourceRef('value')
      const sourceMeta = new PlsqlExpression(effectiveMeta.type, merge.sourceRef('meta').toSQL())
      body.query(
        merge
          .on((t, source) => cond.eq(t.id, source.id))
          .whenMatched({
            value: sourceValue,
            meta: odbOracle.nvl(sourceMeta, target.meta),
          })
          .whenNotMatched({
            id: sourceId,
            value: sourceValue,
            meta: odbOracle.nvl(sourceMeta, odbLiteral('{}')),
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

  return { list, read, readMasked, write, remove }
})
