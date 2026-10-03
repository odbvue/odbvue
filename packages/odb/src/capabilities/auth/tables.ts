import { odbTable } from '../../schema/table.js'

export const authUsers = odbTable('odb_auth_users', (t) => ({
  id: t.guid().primaryKey().defaultSysGuid(),
  username: t.string(128).notNull(),
  passwordHash: t.string(512).notNull(),
  displayName: t.string(256),
  enabled: t.boolean().notNull().default(true),
  tokenVersion: t.number().notNull().default(0),
  createdAt: t.timestamp().notNull().defaultSysTimestamp(),
  updatedAt: t.timestamp().notNull().defaultSysTimestamp(),
})).unique('odb_auth_users_uq_username', (columns) => [columns.username])

export const authSessions = odbTable('odb_auth_sessions', (t) => ({
  id: t.guid().primaryKey().defaultSysGuid(),
  userId: t.guid().notNull(),
  refreshTokenHash: t.string(128).notNull(),
  previousRefreshTokenHash: t.string(128),
  expiresAt: t.timestamp().notNull(),
  revokedAt: t.timestamp(),
  createdAt: t.timestamp().notNull().defaultSysTimestamp(),
  lastUsedAt: t.timestamp(),
  userAgent: t.string(512),
  ipAddress: t.string(64),
}))
  .index('odb_auth_sessions_ix_user', (columns) => [columns.userId])
  .unique('odb_auth_sessions_uq_token', (columns) => [columns.refreshTokenHash])

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
