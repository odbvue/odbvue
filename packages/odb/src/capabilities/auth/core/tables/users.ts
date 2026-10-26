import { odbTable } from '../../../../schema/table.js'
import { storageFiles } from '../../../storage/tables.js'

export const authUsers = odbTable('odb_auth_users', (t) => ({
  id: t.guid().primaryKey().defaultSysGuid(),
  username: t.string(128).notNull(),
  displayName: t.string(256),
  avatar: t.guid(),
  googleAvatarUrl: t.string(2048),
  enabled: t.boolean().notNull().default(true),
  tokenVersion: t.number().notNull().default(0),
  createdAt: t.timestamp().notNull().defaultSysTimestamp(),
  updatedAt: t.timestamp().notNull().defaultSysTimestamp(),
}))
  .unique('odb_auth_users_uq_username', (columns) => [columns.username])
  .unique('odb_auth_users_uq_email', ['LOWER(TRIM(username))'])
  .foreignKey(
    'odb_auth_users_fk_avatar',
    (columns) => [columns.avatar],
    storageFiles,
    (columns) => [columns.id],
    { onDelete: 'set null' },
  )
