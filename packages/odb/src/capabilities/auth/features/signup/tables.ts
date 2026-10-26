import { odbTable } from '../../../../schema/table.js'
import { authUsers } from '../../core/tables/users.js'

export const authConfirmations = odbTable('odb_auth_confirmations', (t) => ({
  userId: t.guid().primaryKey(),
  tokenHash: t.string(128).notNull(),
  expiresAt: t.timestamp().notNull(),
}))
  .unique('odb_auth_confirmations_uq_token', (columns) => [columns.tokenHash])
  .foreignKey(
    'odb_auth_confirmations_fk_user',
    (columns) => [columns.userId],
    authUsers,
    (columns) => [columns.id],
    { onDelete: 'cascade' },
  )
