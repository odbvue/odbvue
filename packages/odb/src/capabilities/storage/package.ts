import { cond, odbLiteral, plsqlExpr, PlsqlExpression } from '../../schema/attribute.js'
import { odbPackage, odbType } from '../../schema/package.js'
import { odbQuery } from '../../query/index.js'
import { odbOracle } from '../../oracle/index.js'
import { DEFAULT_LIMIT, MAX_FILE_BYTES, PACKAGE_NAME } from './constants.js'
import { storageFiles } from './tables.js'
import { storageTypes } from './types.js'

export const odbStoragePackage = odbPackage(PACKAGE_NAME, (pkg) => {
  const list = pkg.proc(
    'list',
    {
      in: { ownerId: storageTypes.ownerId, after: storageTypes.id, limit: odbType.integer() },
      out: { items: odbType.resultset() },
    },
    ({ params: { ownerId, after, limit, items }, body }) => {
      body.ifThen(cond.isNull(ownerId), (then) => then.invalid('STORAGE_OWNER_REQUIRED'))
      body.ifThen(cond.or([cond.lt(limit, 1), cond.gt(limit, 101)]), (then) =>
        then.invalid('STORAGE_LIMIT_INVALID'),
      )
      body.openFor(
        items,
        odbQuery()
          .selectFrom(storageFiles)
          .select([
            storageFiles.id,
            storageFiles.fileName,
            storageFiles.mimeType,
            storageFiles.fileSize,
            storageFiles.meta,
            storageFiles.createdAt,
          ])
          .where(
            cond.and([
              cond.eq(storageFiles.ownerId, ownerId),
              cond.or([cond.isNull(after), cond.gt(storageFiles.id, after)]),
            ]),
          )
          .orderBy(storageFiles.id)
          .limit(plsqlExpr.call('PLS_INTEGER', 'NVL', limit, odbLiteral(DEFAULT_LIMIT))),
      )
    },
  )

  const write = pkg.proc(
    'write',
    {
      in: {
        ownerId: storageTypes.ownerId,
        fileName: storageTypes.fileName,
        mimeType: storageTypes.mimeType,
        content: storageTypes.content,
        meta: storageTypes.meta,
      },
      out: { id: storageTypes.id },
    },
    ({ params: { ownerId, fileName, mimeType, content, meta, id }, body }) => {
      const { fileSize } = body.variables({ fileSize: storageTypes.fileSize })
      body.ifThen(cond.isNull(ownerId), (then) => then.invalid('STORAGE_OWNER_REQUIRED'))
      body.ifThen(
        cond.or([
          cond.isNull(odbOracle.trim(fileName)),
          cond.gt(odbOracle.length(fileName), 255),
          cond.gt(odbOracle.instr(fileName, odbOracle.chr(92)), 0),
          cond.regexpLike(fileName, '[[:cntrl:]/]'),
        ]),
        (then) => then.invalid('STORAGE_FILENAME_INVALID'),
      )
      body.ifThen(cond.isNull(content), (then) => then.invalid('STORAGE_CONTENT_REQUIRED'))
      body.ifThen(
        cond.and([
          cond.isNotNull(mimeType),
          cond.or([
            cond.gt(odbOracle.length(mimeType), 200),
            cond.not(cond.regexpLike(mimeType, '^[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+$')),
          ]),
        ]),
        (then) => then.invalid('STORAGE_MIME_TYPE_INVALID'),
      )
      body.ifThen(cond.isNotNull(meta), (then) => {
        then.ifThen(cond.not(cond.isJson(meta)), (invalid) =>
          invalid.invalid('STORAGE_META_INVALID'),
        )
      })
      body.set(fileSize, plsqlExpr.call('NUMBER', 'DBMS_LOB.GETLENGTH', content))
      body.ifThen(cond.gt(fileSize, MAX_FILE_BYTES), (then) =>
        then.invalid('STORAGE_FILE_TOO_LARGE'),
      )
      body.set(id, odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid())))
      body.insertInto(storageFiles, {
        id,
        ownerId,
        fileName: odbOracle.trim(fileName),
        mimeType: odbOracle.nvl(mimeType, odbLiteral('application/octet-stream')),
        fileSize,
        content,
        meta: odbOracle.nvl(meta, odbLiteral('{}')),
      })
    },
  )

  const read = pkg.proc(
    'read',
    {
      in: { ownerId: storageTypes.ownerId, id: storageTypes.id },
      out: {
        fileName: storageTypes.fileName,
        mimeType: storageTypes.mimeType,
        fileSize: storageTypes.fileSize,
        content: storageTypes.content,
        meta: storageTypes.meta,
      },
    },
    ({ params: { ownerId, id, fileName, mimeType, fileSize, content, meta }, body }) => {
      body.query(
        odbQuery()
          .selectFrom(storageFiles)
          .select([
            storageFiles.fileName,
            storageFiles.mimeType,
            storageFiles.fileSize,
            storageFiles.content,
            storageFiles.meta,
          ])
          .into(fileName, mimeType, fileSize, content, meta)
          .where(cond.and([cond.eq(storageFiles.id, id), cond.eq(storageFiles.ownerId, ownerId)])),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.notFound('STORAGE_FILE_NOT_FOUND'))
    },
  )

  const remove = pkg.proc(
    'remove',
    { in: { ownerId: storageTypes.ownerId, id: storageTypes.id } },
    ({ params: { ownerId, id }, body }) => {
      body.query(
        odbQuery()
          .deleteFrom(storageFiles)
          .where(cond.and([cond.eq(storageFiles.id, id), cond.eq(storageFiles.ownerId, ownerId)])),
      )
      body.ifThen(cond.eq(new PlsqlExpression('NUMBER', 'SQL%ROWCOUNT'), 0), (then) =>
        then.notFound('STORAGE_FILE_NOT_FOUND'),
      )
    },
  )
  return { list, write, read, remove }
})
