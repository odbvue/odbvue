-- liquibase formatted sql
-- changeset ODBVUE:1763714037498 stripComments:false  logicalFilePath:featconsents\odbvue\tables\app_consents.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_consents.sql:null:747e6a41edb844c1049a74e2ee188a61c9fc85ef:create

CREATE TABLE odbvue.app_consents (
    id          CHAR(32 CHAR) DEFAULT lower(sys_guid()) NOT NULL ENABLE,
    language_id CHAR(2 CHAR) DEFAULT 'EN' NOT NULL ENABLE,
    name        VARCHAR2(200 CHAR) NOT NULL ENABLE,
    content     CLOB NOT NULL ENABLE,
    created     TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    active      CHAR(1 CHAR) DEFAULT 'Y' NOT NULL ENABLE
);

ALTER TABLE odbvue.app_consents
    ADD CONSTRAINT chk_app_consents_active
        CHECK ( active IN ( 'Y', 'N' ) ) ENABLE;

ALTER TABLE odbvue.app_consents
    ADD CONSTRAINT cpk_app_consents PRIMARY KEY ( id )
        USING INDEX ENABLE;

