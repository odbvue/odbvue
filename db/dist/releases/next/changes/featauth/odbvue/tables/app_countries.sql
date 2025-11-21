-- liquibase formatted sql
-- changeset ODBVUE:1763708911330 stripComments:false  logicalFilePath:featauth\odbvue\tables\app_countries.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_countries.sql:null:d9ced0ea2db7011d0ce23a0f97e2c871e9a84438:create

CREATE TABLE odbvue.app_countries (
    id      CHAR(2 CHAR) NOT NULL ENABLE,
    iso3    CHAR(3 CHAR) NOT NULL ENABLE,
    name    VARCHAR2(200 CHAR) NOT NULL ENABLE,
    native  VARCHAR2(200 CHAR) NOT NULL ENABLE,
    active  CHAR(1 CHAR) DEFAULT 'Y' NOT NULL ENABLE,
    created TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE
);

ALTER TABLE odbvue.app_countries
    ADD CONSTRAINT chk_app_countries_active
        CHECK ( active IN ( 'Y', 'N' ) ) ENABLE;

ALTER TABLE odbvue.app_countries
    ADD CONSTRAINT pk_app_countries PRIMARY KEY ( id )
        USING INDEX ENABLE;

ALTER TABLE odbvue.app_countries ADD UNIQUE ( iso3 )
    USING INDEX ENABLE;

