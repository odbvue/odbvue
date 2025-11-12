-- liquibase formatted sql
-- changeset  SqlCl:1762984281720 stripComments:false logicalFilePath:main\_custom\.srcdatabaseodbvuecommentsapp_settings.sql
-- sqlcl_snapshot dist\releases\next\changes\main\_custom\.srcdatabaseodbvuecommentsapp_settings.sql:null:null:custom



COMMENT ON TABLE odbvue.app_settings IS
    'Table for storing application settings';

COMMENT ON COLUMN odbvue.app_settings.id IS
    'Unique identifier of the setting';

COMMENT ON COLUMN odbvue.app_settings.name IS
    'Name of the setting';

COMMENT ON COLUMN odbvue.app_settings.options IS
    'Additional options in JSON format';

COMMENT ON COLUMN odbvue.app_settings.value IS
    'Value of the setting';

