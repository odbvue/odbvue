-- liquibase formatted sql
-- changeset  SqlCl:1763835473278 stripComments:false logicalFilePath:featsecrets\_custom\020_settings_smtp.sql
-- sqlcl_snapshot dist\releases\next\changes\featsecrets\_custom\020_settings_smtp.sql:null:null:custom


SET DEFINE OFF;

MERGE INTO app_settings d
USING (SELECT 
    'APP_EMAILS_SMTP_USERNAME' AS id, 
    'SMTP Username' AS name, 
    'ocid1.user.oc1..aaaaaaaaihgo2mj4vwgl6ankj5c4fkek7pek7bqhj6hmscryz24zk22wgxna@ocid1.tenancy.oc1..aaaaaaaaqq6caf32ecspmq3gunerzx6f3hrldykufeggxnark467nidnfnhq.xy.com' AS value FROM dual) s
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
    'APP_EMAILS_SMTP_PASSWORD' AS id, 
    'SMTP Password (encrypted with Master Key)' AS name, 
    'Oy3CXNRofx9yjPOPnzffbhjDvG7dh+/I4vG0kznxRkg=' AS value, 
    'Y' AS secret FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value,
        d.secret = s.secret
WHEN NOT MATCHED THEN
    INSERT (id, name, value, secret)
    VALUES (s.id, s.name, s.value, s.secret);


