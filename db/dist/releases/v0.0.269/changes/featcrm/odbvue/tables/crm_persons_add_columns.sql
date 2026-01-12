-- liquibase formatted sql
-- changeset ODBVUE:1768206719900 stripComments:false  logicalFilePath:featcrm\odbvue\tables\crm_persons_add_columns.sql

ALTER TABLE odbvue.crm_persons ADD (
    phone VARCHAR2(200 CHAR),
    email VARCHAR2(200 CHAR)
);
