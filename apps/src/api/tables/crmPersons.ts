import { Table } from '@odbvue/db'

export const crmPersons = new Table()
  .create('crm_persons', 'CRM Person Table')
  .addColumn('id', 'NUMBER(19,0)', null, false, true)
  .addColumn('guid', 'RAW(16)', 'SYS_GUID() ', false, false, true)
  .addColumn('type', 'CHAR(1 CHAR)', null, false, false, false)
  .addColumn('first_name', 'VARCHAR2(200 CHAR)', null, true, false, false)
  .addColumn('last_name', 'VARCHAR2(200 CHAR)', null, true, false, false)
  .addColumn('legal_name', 'VARCHAR2(2000 CHAR)', null, true, false, false)
  .addColumn('status', 'CHAR(1 CHAR)', 'A', false, false, false)
  .addColumn('attributes', 'CLOB', null, true, false, false)
  .addColumn('created', 'TIMESTAMP(6)', 'SYSTIMESTAMP ', false, false, false)
  .addColumn('modified', 'TIMESTAMP(6)', 'SYSTIMESTAMP ', true, false, false)
  .primaryKey('id')
  .addUnique(['guid'])
  .addIndex(['created'])
  .addIndexes([
    ['type', 'status'],
    ['first_name', 'last_name'],
  ])
