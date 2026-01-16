import { Table } from '@odbvue/db'

export const appUsers = new Table()
  .create('app_users', 'Application Users Table')
  .addColumn('id', 'NUMBER(19,0)', null, false, true)
  .addColumn('uuid', 'RAW(16)', 'SYS_GUID() ', false, false, true)
  .addColumn('username', 'VARCHAR2(203 CHAR)', null, false, false, true)
  .addColumn('fullname', 'VARCHAR2(200 CHAR)', null, false, false, false)
  .addColumn('created', 'TIMESTAMP(6)', 'SYSTIMESTAMP ', false, false, false)
  .addColumn('updated', 'TIMESTAMP(6)', null, true, false, false)
  .primaryKey('id')

// Example of the rendered JSON schema for the appUsers table

/*
{
      "name": "APP_USERS",
      "columns": [
        {
          "name": "ID",
          "type": "NUMBER(19,0)",
          "default": null,
          "nullable": false,
          "identity": true
        },
        {
          "name": "UUID",
          "type": "RAW(16)",
          "default": "SYS_GUID() ",
          "nullable": false,
          "identity": false
        },
        {
          "name": "USERNAME",
          "type": "VARCHAR2(200 CHAR)",
          "default": null,
          "nullable": false,
          "identity": false
        },
        {
          "name": "FULLNAME",
          "type": "VARCHAR2(200 CHAR)",
          "default": null,
          "nullable": false,
          "identity": false
        },
        {
          "name": "CREATED",
          "type": "TIMESTAMP(6)",
          "default": "SYSTIMESTAMP ",
          "nullable": false,
          "identity": false
        },
        {
          "name": "UPDATED",
          "type": "TIMESTAMP(6)",
          "default": null,
          "nullable": true,
          "identity": false
        }
      ],
      "primary_key": ["ID"],
      "unique": [["UUID"], ["USERNAME"]],
      "indexes": null,
      "foreignKeys": null
    }
      */
