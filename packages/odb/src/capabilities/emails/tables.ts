import { odbTable } from '../../schema/table.js'
import { storageFiles } from '../storage/tables.js'

export const emails = odbTable('odb_emails_queue', (t) => ({
  id: t.guid().primaryKey().defaultSysGuid(),
  subject: t.string(240).notNull(),
  content: t.column('content', 'clob').notNull(),
  priority: t.number().precision(1).notNull().default(3),
  status: t.string(1).notNull().default('N'),
  created: t.timestamp().notNull().defaultSysTimestamp(),
  delivered: t.timestamp(),
  attempts: t.number().precision(10).notNull().default(0),
  postponed: t.timestamp(),
  error: t.string(2000),
}))
  .check('odb_emails_chk_status', "status IN ('N', 'S', 'E')")
  .check('odb_emails_chk_priority', 'priority BETWEEN 1 AND 5')
  .check('odb_emails_chk_attempts', 'attempts >= 0')
  .index('odb_emails_ix_queue', (c) => [c.status, c.postponed, c.priority, c.created])

export const emailsAddr = odbTable('odb_emails_addr', (t) => ({
  idEmail: t.guid().primaryKey(),
  addrType: t.string(7).primaryKey(),
  addrAddr: t.string(240).primaryKey(),
  addrName: t.string(240),
}))
  .check('odb_emails_addr_chk_type', "addr_type IN ('From', 'ReplyTo', 'To', 'Cc', 'Bcc')")
  .foreignKey(
    'odb_emails_addr_fk_email',
    (c) => [c.idEmail],
    emails,
    (c) => [c.id],
    {
      onDelete: 'cascade',
    },
  )

export const emailsAttc = odbTable('odb_emails_attc', (t) => ({
  idEmail: t.guid().primaryKey(),
  idStorage: t.guid().primaryKey(),
}))
  .foreignKey(
    'odb_emails_attc_fk_email',
    (c) => [c.idEmail],
    emails,
    (c) => [c.id],
    {
      onDelete: 'cascade',
    },
  )
  .foreignKey(
    'odb_emails_attc_fk_storage',
    (c) => [c.idStorage],
    storageFiles,
    (c) => [c.id],
  )
  .index('odb_emails_attc_ix_storage', (c) => [c.idStorage])
