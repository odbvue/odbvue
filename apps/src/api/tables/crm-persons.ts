import { Table, columnType as ct } from '@/api/table'

export const crmPersons = new Table()
  .create('crm_persons', 'CRM Person Table')
  .primaryKey('id')
  .col('id', ct.numberIdentity, 'Primary key')
  .notNullable()
  .col('guid', ct.guidDefault, 'Global Unique Identifier')
  .unique()
  .notNullable()
  .col('type', ct.symbol, 'Person type (I = Individual, O = Organization)')
  .notNullable()
  .check(['I', 'O'])
  .col('first_name', ct.string200, 'First name')
  .col('last_name', ct.string200, 'Last name')
  .col('legal_name', ct.string2000, 'Legal name')
  .col('status', ct.symbol, 'Status (A = Active, B = Blocked, C = Closed)')
  .notNullable()
  .check(['A', 'B', 'C'])
  .default('A')
  .col('attributes', ct.jsonData, 'Attributes')
  .col('created', ct.timestampAudit, 'Creation timestamp')
  .notNullable()
  .indexed()
  .col('modified', ct.timestampAudit, 'Last modification timestamp')
  .addIndexes([
    ['type', 'status'],
    ['first_name', 'last_name'],
  ])
