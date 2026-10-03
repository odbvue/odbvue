import { odbTable } from '../../schema/table.js'
import { SCOPE_LENGTH, SUBJECT_HASH_LENGTH } from './constants.js'

export const rateLimitBuckets = odbTable('odb_rate_limit_buckets', (t) => ({
  scope: t.string(SCOPE_LENGTH).notNull().primaryKey(),
  subjectHash: t.string(SUBJECT_HASH_LENGTH).notNull().primaryKey(),
  windowStartedAt: t.timestamp().notNull(),
  failureCount: t.number().notNull(),
  blockedUntil: t.timestamp(),
}))
