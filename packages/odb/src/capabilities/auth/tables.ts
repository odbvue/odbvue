import { odbTable } from '../../schema/table.js'

export const authUsers = odbTable('odb_auth_users', (t) => ({
  id: t.guid().primaryKey().defaultSysGuid(),
  username: t.string(128).notNull(),
  displayName: t.string(256),
  avatar: t.clob(),
  googleAvatarUrl: t.string(2048),
  enabled: t.boolean().notNull().default(true),
  tokenVersion: t.number().notNull().default(0),
  createdAt: t.timestamp().notNull().defaultSysTimestamp(),
  updatedAt: t.timestamp().notNull().defaultSysTimestamp(),
}))
  .unique('odb_auth_users_uq_username', (columns) => [columns.username])
  .unique('odb_auth_users_uq_email', ['LOWER(TRIM(username))'])

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
