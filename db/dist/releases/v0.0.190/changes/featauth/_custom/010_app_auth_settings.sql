-- liquibase formatted sql
-- changeset  SqlCl:1763581847372 stripComments:false logicalFilePath:featauth\_custom\010_app_auth_settings.sql
-- sqlcl_snapshot dist\releases\next\changes\featauth\_custom\010_app_auth_settings.sql:null:null:custom

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_SAFE_ATTEMPTS' AS id, 'App authentication safe attempts' AS name, '5' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_BASE_DELAY' AS id, 'App authentication base delay in seconds' AS name, '5' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_MAX_DELAY' AS id, 'App authentication max delay in seconds' AS name, '3600' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_JWT_ISSUER' AS id, 'App authentication JWT issuer' AS name, 'OdbVue' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_JWT_AUDIENCE' AS id, 'App authentication JWT audience' AS name, 'OdbVue Audience' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_JWT_SECRET' AS id, 'App authentication JWT secret' AS name, DBMS_RANDOM.STRING('A', 200) AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);
