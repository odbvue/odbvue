import type { PlsqlRenderable } from '../../schema/attribute.js'
import { MAX_FILE_BYTES } from './constants.js'
import { odbStoragePackage } from './package.js'
import { storageFiles } from './tables.js'
import { storageTypes } from './types.js'

export const odbStorage = {
  toSQLUp(options: { schema?: string } = {}): string {
    return [storageFiles.toSQLUp(options), odbStoragePackage.toSQLUp(options)].join('\n')
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [odbStoragePackage.toSQLDown(options), storageFiles.toSQLDown(options)].join('\n')
  },
  types: storageTypes,
  maxFileBytes: MAX_FILE_BYTES,
  list(
    ownerId: PlsqlRenderable,
    after: PlsqlRenderable,
    limit: PlsqlRenderable,
    items: PlsqlRenderable,
  ) {
    return odbStoragePackage.list(ownerId, after, limit, items)
  },
  write(
    ownerId: PlsqlRenderable,
    fileName: PlsqlRenderable,
    mimeType: PlsqlRenderable,
    content: PlsqlRenderable,
    meta: PlsqlRenderable,
    id: PlsqlRenderable,
  ) {
    return odbStoragePackage.write(ownerId, fileName, mimeType, content, meta, id)
  },
  read(
    ownerId: PlsqlRenderable,
    id: PlsqlRenderable,
    fileName: PlsqlRenderable,
    mimeType: PlsqlRenderable,
    fileSize: PlsqlRenderable,
    content: PlsqlRenderable,
    meta: PlsqlRenderable,
  ) {
    return odbStoragePackage.read(ownerId, id, fileName, mimeType, fileSize, content, meta)
  },
  remove(ownerId: PlsqlRenderable, id: PlsqlRenderable) {
    return odbStoragePackage.remove(ownerId, id)
  },
}
