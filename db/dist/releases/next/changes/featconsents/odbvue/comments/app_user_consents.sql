-- liquibase formatted sql
-- changeset odbvue:1763714036883 stripComments:false  logicalFilePath:featconsents\odbvue\comments\app_user_consents.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_user_consents.sql:null:2f579119dbef8640c50c97c131a65aa10ac921c9:create

COMMENT ON TABLE odbvue.app_user_consents IS
    'Table to track user consents given for various applications.';

COMMENT ON COLUMN odbvue.app_user_consents.consent_id IS
    'Identifier for the consent given by the user.';

COMMENT ON COLUMN odbvue.app_user_consents.given IS
    'Timestamp when the consent was given by the user.';

COMMENT ON COLUMN odbvue.app_user_consents.revoked IS
    'Timestamp when the consent was revoked by the user.';

COMMENT ON COLUMN odbvue.app_user_consents.user_id IS
    'Unique identifier for the user.';

