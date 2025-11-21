-- liquibase formatted sql
-- changeset odbvue:1763708910767 stripComments:false  logicalFilePath:featauth\odbvue\comments\app_currencies.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_currencies.sql:null:f73bf44a8223ac72c4fdd9c5a8e116264e0bb8a5:create

COMMENT ON TABLE odbvue.app_currencies IS
    'Table of currencies';

COMMENT ON COLUMN odbvue.app_currencies.active IS
    'Indicates if the currency is active';

COMMENT ON COLUMN odbvue.app_currencies.created IS
    'Record creation timestamp';

COMMENT ON COLUMN odbvue.app_currencies.id IS
    'ISO 4217 currency code (3 letters)';

COMMENT ON COLUMN odbvue.app_currencies.name IS
    'Currency name in English';

COMMENT ON COLUMN odbvue.app_currencies.symbol IS
    'Currency symbol';

