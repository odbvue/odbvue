import { Schema, Table } from '@odbvue/db'

const appRolesTable = new Table()
  .addColumn('ID', 'NUMBER(19,0)', null, false, true)
  .addColumn('ROLE', 'VARCHAR2(200 CHAR)', null, false)
  .addColumn('DESCRIPTION', 'VARCHAR2(2000 CHAR)')
  .primaryKey(['ID'])

export const schema = new Schema('odbvue').addTable(appRolesTable)
