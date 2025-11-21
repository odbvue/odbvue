-- liquibase formatted sql
-- changeset ODBVUE:1763708911508 stripComments:false  logicalFilePath:featauth\odbvue\tables\app_languages.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_languages.sql:null:f4b8cb9d8c2139e6cf8c639131fb2cdb44439659:create

CREATE TABLE odbvue.app_languages (
    id      CHAR(2 CHAR) NOT NULL ENABLE,
    iso3    CHAR(3 CHAR),
    name    VARCHAR2(200 CHAR) NOT NULL ENABLE,
    native  VARCHAR2(200 CHAR) NOT NULL ENABLE,
    active  CHAR(1 CHAR) DEFAULT 'Y' NOT NULL ENABLE,
    created TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE
);

ALTER TABLE odbvue.app_languages
    ADD CONSTRAINT chk_app_languages_active
        CHECK ( active IN ( 'Y', 'N' ) ) ENABLE;

ALTER TABLE odbvue.app_languages
    ADD CONSTRAINT cpk_app_languages PRIMARY KEY ( id )
        USING INDEX ENABLE;

