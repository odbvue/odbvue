-- liquibase formatted sql
-- changeset odbvue:1763841490354 stripComments:false  logicalFilePath:featsecrets\odbvue\comments\app_settings.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_settings.sql:e1ae593d5b601e6b254cef2b61fc5931ff9ac02b:4f2d427b04e3db5924a0de7dfb8ac2d681d3bd46:alter

COMMENT ON TABLE odbvue.app_settings IS
    'Table for storing application settings';

COMMENT ON COLUMN odbvue.app_settings.id IS
    'Unique identifier of the setting';

COMMENT ON COLUMN odbvue.app_settings.name IS
    'Name of the setting';

COMMENT ON COLUMN odbvue.app_settings.options IS
    'Additional options (e.g. rules) in JSON format';

COMMENT ON COLUMN odbvue.app_settings.secret IS
    'Indicates if the setting value is sensitive and should be hidden in UIs';

COMMENT ON COLUMN odbvue.app_settings.value IS
    'Value of the setting';

