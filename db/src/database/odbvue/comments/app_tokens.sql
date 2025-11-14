COMMENT ON TABLE odbvue.app_tokens IS
    'Table for storing and processing user tokens';

COMMENT ON COLUMN odbvue.app_tokens.created IS
    'Date and time when token was created';

COMMENT ON COLUMN odbvue.app_tokens.expiration IS
    'Date and time when token expires';

COMMENT ON COLUMN odbvue.app_tokens.token IS
    'Token content, primary key';

COMMENT ON COLUMN odbvue.app_tokens.type_id IS
    'Reference to token type (APP_TOKEN_TYPES.ID)';

COMMENT ON COLUMN odbvue.app_tokens.uuid IS
    'Reference to user (APP_USERS.UUID)';


-- sqlcl_snapshot {"hash":"0ee8d9f06425193ef6f70fbbfaf677410fa48422","type":"COMMENT","name":"app_tokens","schemaName":"odbvue","sxml":""}