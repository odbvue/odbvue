-- liquibase formatted sql
-- changeset ODBVUE:1763714037586 stripComments:false  logicalFilePath:featconsents\odbvue\tables\app_user_consents.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_user_consents.sql:null:f8ae318c1c99a596c34ff2530fd02a7f860d4f39:create

CREATE TABLE odbvue.app_user_consents (
    user_id    CHAR(32 CHAR) NOT NULL ENABLE,
    consent_id CHAR(32 CHAR) NOT NULL ENABLE,
    given      TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    revoked    TIMESTAMP(6)
);

ALTER TABLE odbvue.app_user_consents
    ADD CONSTRAINT cpk_app_user_consents PRIMARY KEY ( user_id,
                                                       consent_id )
        USING INDEX ENABLE;

