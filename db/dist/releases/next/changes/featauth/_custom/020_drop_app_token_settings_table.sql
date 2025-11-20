-- liquibase formatted sql
-- changeset  SqlCl:1763619456182 stripComments:false logicalFilePath:featauth\_custom\020_drop_app_token_settings_table.sql
-- sqlcl_snapshot dist\releases\next\changes\featauth\_custom\020_drop_app_token_settings_table.sql:null:null:custom

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE app_token_settings';
EXCEPTION
   WHEN OTHERS THEN
      IF SQLCODE != -942 THEN  -- ORA-00942: table or view does not exist
         RAISE;
      END IF;
END;
/

