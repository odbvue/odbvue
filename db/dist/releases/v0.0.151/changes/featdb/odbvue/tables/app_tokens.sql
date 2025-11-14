-- liquibase formatted sql
-- changeset ODBVUE:1763119014438 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_tokens.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_tokens.sql:null:a1775cee87f7373975e0ce1efe2aa7afa607d290:create

CREATE TABLE odbvue.app_tokens (
    uuid       CHAR(32 CHAR) NOT NULL ENABLE,
    token      VARCHAR2(2000 CHAR) NOT NULL ENABLE,
    type_id    VARCHAR2(30 CHAR) NOT NULL ENABLE,
    created    TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    expiration TIMESTAMP(6) NOT NULL ENABLE
);

ALTER TABLE odbvue.app_tokens
    ADD CONSTRAINT cpk_app_tokens PRIMARY KEY ( token )
        USING INDEX ENABLE;

