import { odbTable } from '../../../../schema/table.js'

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
