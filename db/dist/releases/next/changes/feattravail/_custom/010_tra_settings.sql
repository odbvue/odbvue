-- liquibase formatted sql
-- changeset  SqlCl:1765368712069 stripComments:false logicalFilePath:feattravail\_custom\010_tra_settings.sql
-- sqlcl_snapshot dist\releases\next\changes\feattravail\_custom\010_tra_settings.sql:null:null:custom


MERGE INTO app_settings d
USING (SELECT 
    'TRA_OPENAI_API_KEY' AS id, 
    'Open AI API Key (encrypted with Master Key)' AS name, 
    'wZHlg44mYy6nSFnDXscxzAhh3LTJeoapHBhRtAYr8tIS3MKc1d+wDfHAghusjtOV
CrJhmGlBo2wUPsGbPJyh4lDz9ZFIy7RsBnrf/ctc5pt6Dcrp1XEgQo8qLAkpe9KA
UXZoLhs/eQE3LrJfNYGDPb+MJS0jtugVsJ5B7y3Pqp/MPjrtbxmqse9UI2UBawMN
cUwOaJFxMcTDUdfifsnOsOUQ9VpgL+uZPONJqW/rN8w=' AS value, 
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

