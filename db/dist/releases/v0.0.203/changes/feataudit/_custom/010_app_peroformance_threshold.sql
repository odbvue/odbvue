-- liquibase formatted sql
-- changeset  SqlCl:1764054550921 stripComments:false logicalFilePath:feataudit\_custom\010_app_peroformance_threshold.sql
-- sqlcl_snapshot dist\releases\next\changes\feataudit\_custom\010_app_peroformance_threshold.sql:null:null:custom

MERGE INTO app_settings d
USING (SELECT 
    'APP_PERFORMANCE_THRESHOLD_MS' AS id, 
    'App performance threshold in milliseconds' AS name, 
    '250' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

