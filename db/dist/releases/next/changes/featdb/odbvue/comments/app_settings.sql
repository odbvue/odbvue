-- liquibase formatted sql
-- changeset odbvue:1763018047535 stripComments:false  logicalFilePath:featdb\odbvue\comments\app_settings.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_settings.sql:3a392070a849d6436a7b1ba9be5202f4e013be33:e1ae593d5b601e6b254cef2b61fc5931ff9ac02b:alter

COMMENT ON TABLE odbvue.app_settings IS
    'Table for storing application settings';

COMMENT ON COLUMN odbvue.app_settings.id IS
    'Unique identifier of the setting';

COMMENT ON COLUMN odbvue.app_settings.name IS
    'Name of the setting';

COMMENT ON COLUMN odbvue.app_settings.options IS
    'Additional options (e.g. rules) in JSON format';

COMMENT ON COLUMN odbvue.app_settings.value IS
    'Value of the setting';

