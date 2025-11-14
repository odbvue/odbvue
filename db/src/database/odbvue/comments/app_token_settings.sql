COMMENT ON TABLE odbvue.app_token_settings IS
    'Table for storing JWT token settings';

COMMENT ON COLUMN odbvue.app_token_settings.audience IS
    'JWT token audience';

COMMENT ON COLUMN odbvue.app_token_settings.issuer IS
    'JWT token issuer';

COMMENT ON COLUMN odbvue.app_token_settings.secret IS
    'JWT token secret key';


-- sqlcl_snapshot {"hash":"e31beebfbf986dab1e7d1a3794dff5294fdf98f9","type":"COMMENT","name":"app_token_settings","schemaName":"odbvue","sxml":""}