-- liquibase formatted sql
-- changeset  SqlCl:1763806772062 stripComments:false logicalFilePath:featsecrets\_custom\010_settings_oci_vault.sql
-- sqlcl_snapshot dist\releases\next\changes\featsecrets\_custom\010_settings_oci_vault.sql:null:null:custom


SET DEFINE OFF;

MERGE INTO app_settings d
USING (SELECT 
    'APP_SETTINGS_MASTER_KEY_LOCAL' AS id, 
    'App fallback Master Key value, should not be used in production' AS name,
    'ROTATED_SET_VIA_ENV_OR_VAULT_NOT_IN_GIT' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 
    'APP_SETTINGS_MASTER_KEY_URI' AS id, 
    'App Master Key uri in OCI Vault' AS name,
    'ROTATED_SET_VIA_ENV_OR_VAULT_NOT_IN_GIT' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);
