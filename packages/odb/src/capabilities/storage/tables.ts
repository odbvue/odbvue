import { odbTable } from '../../schema/table.js'
import { MAX_FILE_BYTES } from './constants.js'

export const storageFiles = odbTable('odb_storage_files', (table) => ({
  id: table.guid().primaryKey().defaultSysGuid(),
  ownerId: table.string(32).notNull(),
  fileName: table.string(255).notNull(),
  mimeType: table.string(200).notNull(),
  fileSize: table.number().precision(19).notNull(),
  content: table.column('content', 'blob').notNull(),
  meta: table.json().default({}).notNull(),
  createdAt: table.timestamp().notNull().defaultSysTimestamp(),
}))
  .check('odb_storage_files_chk_size', `file_size BETWEEN 0 AND ${MAX_FILE_BYTES}`)
  .index('odb_storage_files_ix_owner', (columns) => [columns.ownerId, columns.id])
