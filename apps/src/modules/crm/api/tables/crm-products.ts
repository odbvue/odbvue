import { Table, columnType as ct } from '../../../../apis/table'
import type { ColumnType } from '../../../../apis/table'

const numberPrice: ColumnType = {
  type: 'number',
  precision: 15,
  scale: 2,
  comment: '',
}

export const crmProducts = new Table()
  .create('crm_products', 'CRM Products Table')
  .primaryKey('id')
  .col('id', ct.numberIdentity, 'Primary key')
  .notNullable()
  .col('guid', ct.guidDefault, 'Global Unique Identifier')
  .unique()
  .notNullable()
  .col('code', ct.string200, 'Product code')
  .unique()
  .notNullable()
  .col('name', ct.string200, 'Product name')
  .notNullable()
  .col('description', ct.string2000, 'Product description')
  .col('price', numberPrice, 'Product price')
  .notNullable()
  .col('status', ct.symbol, 'Status (A = Active, I = Inactive)')
  .notNullable()
  .check(['A', 'I'])
  .default('A')
  .col('created', ct.timestampAudit, 'Creation timestamp')
  .notNullable()
  .indexed()
  .col('modified', ct.timestampAudit, 'Last modification timestamp')
  .addIndexes([['name'], ['status']])
