-- liquibase formatted sql
-- changeset  SqlCl:1763039375971 stripComments:false logicalFilePath:main\_custom\admin_pck_api_syno.sql
-- sqlcl_snapshot dist\releases\next\changes\main\_custom\admin_pck_api_syno.sql:null:null:custom

CREATE OR REPLACE SYNONYM odbvue.pck_api_admin FOR admin.pck_api_admin;


