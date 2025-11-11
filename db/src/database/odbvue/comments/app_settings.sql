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


-- sqlcl_snapshot {"hash":"3a392070a849d6436a7b1ba9be5202f4e013be33","type":"COMMENT","name":"app_settings","schemaName":"odbvue","sxml":""}