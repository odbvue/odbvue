import { odbTable } from '../../../../schema/table.js'
import { authUsers } from '../../core/tables/users.js'

export const authPasswordResets = odbTable('odb_auth_password_resets', (t) => ({
  userId: t.guid().primaryKey(),
  tokenHash: t.string(128).notNull(),
  expiresAt: t.timestamp().notNull(),
}))
  .unique('odb_auth_pw_resets_uq_token', (columns) => [columns.tokenHash])
  .foreignKey(
    'odb_auth_pw_resets_fk_user',
    (columns) => [columns.userId],
    authUsers,
    (columns) => [columns.id],
    { onDelete: 'cascade' },
  )
