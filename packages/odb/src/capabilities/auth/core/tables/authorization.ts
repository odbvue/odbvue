import { odbTable } from '../../../../schema/table.js'
import { authUsers } from './users.js'

export const authRoles = odbTable('odb_auth_roles', (t) => ({
  role: t.string(200).primaryKey(),
  description: t.string(2000),
}))

export const authUserRoles = odbTable('odb_auth_user_roles', (t) => ({
  userId: t.guid().primaryKey(),
  role: t.string(200).primaryKey(),
  validFrom: t.timestamp().notNull().defaultSysTimestamp(),
  validTo: t.timestamp(),
}))
  .index('odb_auth_user_roles_ix_role', (columns) => [columns.role])
  .check('odb_auth_user_roles_chk_dates', 'valid_to > valid_from')
  .foreignKey(
    'odb_auth_user_roles_fk_user',
    (columns) => [columns.userId],
    authUsers,
    (columns) => [columns.id],
    { onDelete: 'cascade' },
  )
  .foreignKey(
    'odb_auth_user_roles_fk_role',
    (columns) => [columns.role],
    authRoles,
    (columns) => [columns.role],
    { onDelete: 'cascade' },
  )

export const authRolePermissions = odbTable('odb_auth_role_permissions', (t) => ({
  role: t.string(200).primaryKey(),
  permission: t.string(200).primaryKey(),
})).foreignKey(
  'odb_auth_role_perms_fk_role',
  (columns) => [columns.role],
  authRoles,
  (columns) => [columns.role],
  { onDelete: 'cascade' },
)
