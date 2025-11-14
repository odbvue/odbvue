-- liquibase formatted sql
-- changeset ODBVUE:1763119014309 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_token_settings.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_token_settings.sql:null:cfbf82961c713c5dd0101646c6104a95fadac6bc:create

CREATE TABLE odbvue.app_token_settings (
    issuer   VARCHAR2(200 BYTE) NOT NULL ENABLE,
    audience VARCHAR2(200 BYTE) NOT NULL ENABLE,
    secret   VARCHAR2(2000 BYTE) NOT NULL ENABLE
);

ALTER TABLE odbvue.app_token_settings
    ADD CONSTRAINT cpk_app_token_settings PRIMARY KEY ( issuer )
        USING INDEX ENABLE;

