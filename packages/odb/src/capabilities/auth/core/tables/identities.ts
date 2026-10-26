import { odbTable } from '../../../../schema/table.js'
import { authUsers } from './users.js'

export const authIdentities = odbTable('odb_auth_identities', (t) => ({
  issuer: t.string(128).notNull(),
  subject: t.string(255).notNull(),
  userId: t.guid().notNull(),
  passwordHash: t.string(512),
  createdAt: t.timestamp().notNull().defaultSysTimestamp(),
}))
  .unique('odb_auth_identities_uq', (columns) => [columns.issuer, columns.subject])
  .unique('odb_auth_identities_uq_local', ["CASE WHEN issuer = 'password' THEN user_id END"])
  .check(
    'odb_auth_identities_chk_secret',
    "(issuer = 'password' AND password_hash IS NOT NULL) OR (issuer != 'password' AND password_hash IS NULL)",
  )
  .index('odb_auth_identities_ix_user', (columns) => [columns.userId])
  .foreignKey(
    'odb_auth_identities_fk_user',
    (columns) => [columns.userId],
    authUsers,
    (columns) => [columns.id],
    { onDelete: 'cascade' },
  )
