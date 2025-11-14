-- liquibase formatted sql
-- changeset odbvue:1763119013209 stripComments:false  logicalFilePath:featdb\odbvue\comments\app_token_types.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_token_types.sql:null:84c3492b0cbdb66dfa7500ba200d1156bccbee7b:create

COMMENT ON TABLE odbvue.app_token_types IS
    'Table for storing token types';

COMMENT ON COLUMN odbvue.app_token_types.expiration IS
    'Token expiration in seconds';

COMMENT ON COLUMN odbvue.app_token_types.id IS
    'Token type id';

COMMENT ON COLUMN odbvue.app_token_types.name IS
    'Token type name';

COMMENT ON COLUMN odbvue.app_token_types.stored IS
    'Is token stored in the database (Y/N)';

