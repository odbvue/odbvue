-- liquibase formatted sql
-- changeset ODBVUE:1763708911437 stripComments:false  logicalFilePath:featauth\odbvue\tables\app_currencies.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_currencies.sql:null:87cde79be602110a031d59f6148fbd4de3a192f8:create

CREATE TABLE odbvue.app_currencies (
    id      CHAR(3 CHAR) NOT NULL ENABLE,
    name    VARCHAR2(200 CHAR) NOT NULL ENABLE,
    symbol  VARCHAR2(10 CHAR),
    active  CHAR(1 CHAR) DEFAULT 'Y' NOT NULL ENABLE,
    created TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE
);

ALTER TABLE odbvue.app_currencies
    ADD CONSTRAINT chk_app_currencies_active
        CHECK ( active IN ( 'Y', 'N' ) ) ENABLE;

ALTER TABLE odbvue.app_currencies
    ADD CONSTRAINT pk_app_currencies PRIMARY KEY ( id )
        USING INDEX ENABLE;

