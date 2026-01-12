-- liquibase formatted sql
-- changeset ODBVUE:hotfix_crm_persons_add_columns stripComments:false  logicalFilePath:hotfix\odbvue\tables\crm_persons_add_columns.sql

-- Add missing columns phone and email to crm_persons table
ALTER TABLE odbvue.crm_persons ADD (
    phone VARCHAR2(200 CHAR),
    email VARCHAR2(200 CHAR)
);
