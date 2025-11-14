-- liquibase formatted sql
-- changeset ODBVUE:1763119014369 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_token_types.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_token_types.sql:null:bb61bc46b1a410f5ff1a1c28f598a339270046f4:create

CREATE TABLE odbvue.app_token_types (
    id         VARCHAR2(30 CHAR) NOT NULL ENABLE,
    name       VARCHAR2(200 CHAR) NOT NULL ENABLE,
    stored     CHAR(1 CHAR) DEFAULT 'N' NOT NULL ENABLE,
    expiration NUMBER(10, 0) NOT NULL ENABLE
);

ALTER TABLE odbvue.app_token_types
    ADD CONSTRAINT cpk_app_token_types PRIMARY KEY ( id )
        USING INDEX ENABLE;

ALTER TABLE odbvue.app_token_types
    ADD CONSTRAINT csc_app_token_types_stored
        CHECK ( stored IN ( 'Y', 'N' ) ) ENABLE;

