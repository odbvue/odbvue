-- liquibase formatted sql
-- changeset ODBVUE:1763841491257 stripComments:false  logicalFilePath:featsecrets\odbvue\tables\app_settings.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_settings.sql:eab877facbdf782bed75e49071911b1f606678d1:339adf0df3bb6e437cf2a107f42429b96a5186b6:alter

ALTER TABLE odbvue.app_settings ADD (
    secret CHAR(1 CHAR) DEFAULT 'N' NOT NULL ENABLE
);

ALTER TABLE odbvue.app_settings
    ADD CONSTRAINT chk_secret
        CHECK ( secret IN ( 'Y', 'N' ) ) ENABLE;

