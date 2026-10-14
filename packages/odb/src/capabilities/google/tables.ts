import { odbTable } from '../../schema/table.js'

export const googleTransactions = odbTable('odb_google_transactions', (t) => ({
  stateHash: t.string(64).primaryKey(),
  browserHash: t.string(64).notNull(),
  nonceHash: t.string(64).notNull(),
  verifier: t.string(64).notNull(),
  clientId: t.string(256).notNull(),
  redirectUri: t.string(2048).notNull(),
  returnPath: t.string(2048).notNull(),
  expiresAt: t.timestamp().notNull(),
})).index('odb_google_transactions_ix_exp', (c) => [c.expiresAt])

/** Only public Google signing keys are cached, never credentials or identity tokens. */
export const googleKeys = odbTable('odb_google_keys', (t) => ({
  id: t.string(16).primaryKey(),
  document: t.clob().notNull(),
  expiresAt: t.timestamp().notNull(),
}))
