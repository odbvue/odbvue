import { odbTable } from '../../../../schema/table.js'
import { authUsers } from '../../core/tables/users.js'

export const authFactors = odbTable('odb_auth_factors', (t) => ({
  userId: t.guid().primaryKey(),
  secret: t.clob().notNull(),
  lastCounter: t.number().notNull().default(-1),
})).foreignKey(
  'odb_auth_factors_fk_user',
  (c) => [c.userId],
  authUsers,
  (c) => [c.id],
  {
    onDelete: 'cascade',
  },
)

export const authChallenges = odbTable('odb_auth_challenges', (t) => ({
  tokenHash: t.string(128).primaryKey(),
  userId: t.guid().notNull(),
  tokenVersion: t.number().notNull(),
  secret: t.clob(),
  expiresAt: t.timestamp().notNull(),
}))
  .unique('odb_auth_challenges_uq_user', (c) => [c.userId])
  .foreignKey(
    'odb_auth_challenges_fk_user',
    (c) => [c.userId],
    authUsers,
    (c) => [c.id],
    {
      onDelete: 'cascade',
    },
  )

export const authRecoveryCodes = odbTable('odb_auth_recovery_codes', (t) => ({
  userId: t.guid().primaryKey(),
  codeHash: t.string(128).primaryKey(),
})).foreignKey(
  'odb_auth_recovery_codes_fk_user',
  (c) => [c.userId],
  authUsers,
  (c) => [c.id],
  {
    onDelete: 'cascade',
  },
)
