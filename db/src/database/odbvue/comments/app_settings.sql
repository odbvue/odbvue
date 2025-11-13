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


-- sqlcl_snapshot {"hash":"e1ae593d5b601e6b254cef2b61fc5931ff9ac02b","type":"COMMENT","name":"app_settings","schemaName":"odbvue","sxml":""}